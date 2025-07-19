// Data validation utilities
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class Validator {
  private errors: string[] = [];

  // Reset validation state
  reset(): Validator {
    this.errors = [];
    return this;
  }

  // Add custom error
  addError(message: string): Validator {
    this.errors.push(message);
    return this;
  }

  // String validations
  required(value: any, fieldName: string): Validator {
    if (value === null || value === undefined || value === '') {
      this.errors.push(`${fieldName} is required`);
    }
    return this;
  }

  string(value: any, fieldName: string): Validator {
    if (value !== null && value !== undefined && typeof value !== 'string') {
      this.errors.push(`${fieldName} must be a string`);
    }
    return this;
  }

  minLength(value: string, min: number, fieldName: string): Validator {
    if (typeof value === 'string' && value.length < min) {
      this.errors.push(`${fieldName} must be at least ${min} characters long`);
    }
    return this;
  }

  maxLength(value: string, max: number, fieldName: string): Validator {
    if (typeof value === 'string' && value.length > max) {
      this.errors.push(`${fieldName} must be no more than ${max} characters long`);
    }
    return this;
  }

  email(value: string, fieldName: string): Validator {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof value === 'string' && !emailRegex.test(value)) {
      this.errors.push(`${fieldName} must be a valid email address`);
    }
    return this;
  }

  phone(value: string, fieldName: string): Validator {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (typeof value === 'string' && !phoneRegex.test(value)) {
      this.errors.push(`${fieldName} must be a valid phone number`);
    }
    return this;
  }

  // Number validations
  number(value: any, fieldName: string): Validator {
    if (value !== null && value !== undefined && typeof value !== 'number') {
      this.errors.push(`${fieldName} must be a number`);
    }
    return this;
  }

  min(value: number, min: number, fieldName: string): Validator {
    if (typeof value === 'number' && value < min) {
      this.errors.push(`${fieldName} must be at least ${min}`);
    }
    return this;
  }

  max(value: number, max: number, fieldName: string): Validator {
    if (typeof value === 'number' && value > max) {
      this.errors.push(`${fieldName} must be no more than ${max}`);
    }
    return this;
  }

  // Array validations
  array(value: any, fieldName: string): Validator {
    if (value !== null && value !== undefined && !Array.isArray(value)) {
      this.errors.push(`${fieldName} must be an array`);
    }
    return this;
  }

  minItems(value: any[], min: number, fieldName: string): Validator {
    if (Array.isArray(value) && value.length < min) {
      this.errors.push(`${fieldName} must have at least ${min} items`);
    }
    return this;
  }

  maxItems(value: any[], max: number, fieldName: string): Validator {
    if (Array.isArray(value) && value.length > max) {
      this.errors.push(`${fieldName} must have no more than ${max} items`);
    }
    return this;
  }

  // Boolean validation
  boolean(value: any, fieldName: string): Validator {
    if (value !== null && value !== undefined && typeof value !== 'boolean') {
      this.errors.push(`${fieldName} must be a boolean`);
    }
    return this;
  }

  // Date validation
  date(value: any, fieldName: string): Validator {
    if (value !== null && value !== undefined) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        this.errors.push(`${fieldName} must be a valid date`);
      }
    }
    return this;
  }

  // Custom validation
  custom(predicate: boolean, message: string): Validator {
    if (!predicate) {
      this.errors.push(message);
    }
    return this;
  }

  // Get validation result
  getResult(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors]
    };
  }
}

// Convenience function for creating new validator
export function validate(): Validator {
  return new Validator();
}

// Specific validators for common use cases
export function validateMessage(content: string): ValidationResult {
  return validate()
    .required(content, 'Message content')
    .string(content, 'Message content')
    .minLength(content, 1, 'Message content')
    .maxLength(content, 1000, 'Message content')
    .getResult();
}

export function validateEmail(email: string): ValidationResult {
  return validate()
    .required(email, 'Email')
    .string(email, 'Email')
    .email(email, 'Email')
    .getResult();
}

export function validatePhone(phone: string): ValidationResult {
  return validate()
    .required(phone, 'Phone')
    .string(phone, 'Phone')
    .phone(phone, 'Phone')
    .getResult();
}

export function validatePassword(password: string): ValidationResult {
  return validate()
    .required(password, 'Password')
    .string(password, 'Password')
    .minLength(password, 8, 'Password')
    .custom(
      /[A-Z]/.test(password),
      'Password must contain at least one uppercase letter'
    )
    .custom(
      /[a-z]/.test(password),
      'Password must contain at least one lowercase letter'
    )
    .custom(
      /\d/.test(password),
      'Password must contain at least one number'
    )
    .getResult();
}

export function validateNickname(nickname: string): ValidationResult {
  return validate()
    .required(nickname, 'Nickname')
    .string(nickname, 'Nickname')
    .minLength(nickname, 2, 'Nickname')
    .maxLength(nickname, 20, 'Nickname')
    .custom(
      /^[a-zA-Z0-9_-]+$/.test(nickname),
      'Nickname can only contain letters, numbers, underscores, and hyphens'
    )
    .getResult();
}

export function validateUserSettings(settings: any): ValidationResult {
  const validator = validate()
    .required(settings, 'Settings')
    .string(settings.language, 'Language')
    .string(settings.theme, 'Theme')
    .boolean(settings.pushNotifications, 'Push notifications')
    .boolean(settings.soundNotifications, 'Sound notifications')
    .boolean(settings.emailNotifications, 'Email notifications');

  // Validate theme values
  if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
    validator.addError('Theme must be light, dark, or auto');
  }

  // Validate language code
  if (settings.language && !/^[a-z]{2}$/.test(settings.language)) {
    validator.addError('Language must be a valid 2-letter code');
  }

  return validator.getResult();
}