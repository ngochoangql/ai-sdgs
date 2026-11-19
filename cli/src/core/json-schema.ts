export interface SchemaError {
  path: string;
  message: string;
}

type SchemaObject = Record<string, unknown>;

function resolveJsonPointer(rootSchema: SchemaObject, ref: string): SchemaObject {
  if (!ref.startsWith('#/')) {
    throw new Error(`Unsupported external $ref '${ref}' in offline schema validator.`);
  }
  const parts = ref
    .slice(2)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: unknown = rootSchema;
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null || !(part in (cur as SchemaObject))) {
      throw new Error(`Unresolvable $ref '${ref}' at segment '${part}'.`);
    }
    cur = (cur as SchemaObject)[part];
  }
  return cur as SchemaObject;
}

function checkType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Validates data deterministically against AI-SDGS JSON Schema (Draft 2020-12 subset).
 */
export function validateJsonSchema(
  data: unknown,
  rootSchema: SchemaObject,
  currentSchema: SchemaObject = rootSchema,
  instancePath = '/'
): SchemaError[] {
  const errors: SchemaError[] = [];

  if (typeof currentSchema.$ref === 'string') {
    const resolved = resolveJsonPointer(rootSchema, currentSchema.$ref);
    return validateJsonSchema(data, rootSchema, resolved, instancePath);
  }

  if (typeof currentSchema.type === 'string') {
    if (!checkType(data, currentSchema.type)) {
      errors.push({
        path: instancePath,
        message: `Expected type '${currentSchema.type}', received '${Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data}'.`
      });
      return errors;
    }
  }

  if (Object.prototype.hasOwnProperty.call(currentSchema, 'const')) {
    if (!deepEqual(data, currentSchema.const)) {
      errors.push({
        path: instancePath,
        message: `Expected constant value ${JSON.stringify(currentSchema.const)}, received ${JSON.stringify(data)}.`
      });
    }
  }

  if (Array.isArray(currentSchema.enum)) {
    if (!currentSchema.enum.some((e) => deepEqual(data, e))) {
      errors.push({
        path: instancePath,
        message: `Value ${JSON.stringify(data)} must be one of ${JSON.stringify(currentSchema.enum)}.`
      });
    }
  }

  if (typeof currentSchema.not === 'object' && currentSchema.not !== null) {
    const notErrors = validateJsonSchema(data, rootSchema, currentSchema.not as SchemaObject, instancePath);
    if (notErrors.length === 0) {
      errors.push({
        path: instancePath,
        message: `Value ${JSON.stringify(data)} matched forbidden 'not' schema condition.`
      });
    }
  }

  if (typeof data === 'string') {
    if (typeof currentSchema.minLength === 'number' && data.length < currentSchema.minLength) {
      errors.push({
        path: instancePath,
        message: `String length ${data.length} is shorter than minLength ${currentSchema.minLength}.`
      });
    }
    if (typeof currentSchema.maxLength === 'number' && data.length > currentSchema.maxLength) {
      errors.push({
        path: instancePath,
        message: `String length ${data.length} exceeds maxLength ${currentSchema.maxLength}.`
      });
    }
    if (typeof currentSchema.pattern === 'string') {
      const re = new RegExp(currentSchema.pattern);
      if (!re.test(data)) {
        errors.push({
          path: instancePath,
          message: `Value '${data}' does not match required pattern '${currentSchema.pattern}'.`
        });
      }
    }
  }

  if (Array.isArray(data)) {
    if (typeof currentSchema.minItems === 'number' && data.length < currentSchema.minItems) {
      errors.push({
        path: instancePath,
        message: `Array has ${data.length} item(s), fewer than minItems ${currentSchema.minItems}.`
      });
    }
    if (typeof currentSchema.maxItems === 'number' && data.length > currentSchema.maxItems) {
      errors.push({
        path: instancePath,
        message: `Array has ${data.length} item(s), exceeding maxItems ${currentSchema.maxItems}.`
      });
    }
    if (currentSchema.uniqueItems === true) {
      const seen = new Set<string>();
      for (let i = 0; i < data.length; i++) {
        const serialized = JSON.stringify(data[i]);
        if (seen.has(serialized)) {
          errors.push({
            path: `${instancePath === '/' ? '' : instancePath}/${i}`,
            message: `Duplicate array item ${serialized} violates uniqueItems.`
          });
        }
        seen.add(serialized);
      }
    }
    if (typeof currentSchema.items === 'object' && currentSchema.items !== null) {
      const itemSchema = currentSchema.items as SchemaObject;
      for (let i = 0; i < data.length; i++) {
        const subPath = `${instancePath === '/' ? '' : instancePath}/${i}`;
        errors.push(...validateJsonSchema(data[i], rootSchema, itemSchema, subPath));
      }
    }
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const props = (currentSchema.properties as Record<string, SchemaObject> | undefined) ?? {};

    if (Array.isArray(currentSchema.required)) {
      for (const reqKey of currentSchema.required) {
        if (typeof reqKey === 'string' && (!Object.prototype.hasOwnProperty.call(obj, reqKey) || obj[reqKey] === undefined || obj[reqKey] === null)) {
          errors.push({
            path: instancePath,
            message: `Missing required property '${reqKey}'.`
          });
        }
      }
    }

    if (currentSchema.additionalProperties === false && Object.keys(props).length > 0) {
      for (const key of Object.keys(obj)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) {
          errors.push({
            path: `${instancePath === '/' ? '' : instancePath}/${key}`,
            message: `Unknown property '${key}' is not allowed (additionalProperties: false).`
          });
        }
      }
    }

    for (const [propKey, propSchema] of Object.entries(props)) {
      if (Object.prototype.hasOwnProperty.call(obj, propKey) && obj[propKey] !== undefined) {
        const subPath = `${instancePath === '/' ? '' : instancePath}/${propKey}`;
        errors.push(...validateJsonSchema(obj[propKey], rootSchema, propSchema, subPath));
      }
    }
  }

  if (typeof currentSchema.if === 'object' && currentSchema.if !== null) {
    const condErrors = validateJsonSchema(data, rootSchema, currentSchema.if as SchemaObject, instancePath);
    if (condErrors.length === 0) {
      if (typeof currentSchema.then === 'object' && currentSchema.then !== null) {
        errors.push(...validateJsonSchema(data, rootSchema, currentSchema.then as SchemaObject, instancePath));
      }
    } else if (typeof currentSchema.else === 'object' && currentSchema.else !== null) {
      errors.push(...validateJsonSchema(data, rootSchema, currentSchema.else as SchemaObject, instancePath));
    }
  }

  if (Array.isArray(currentSchema.allOf)) {
    for (const subSchema of currentSchema.allOf) {
      if (typeof subSchema === 'object' && subSchema !== null) {
        errors.push(...validateJsonSchema(data, rootSchema, subSchema as SchemaObject, instancePath));
      }
    }
  }

  return errors;
}
