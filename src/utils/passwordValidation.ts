export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  requirements: PasswordRequirement[];
  strength: 'weak' | 'medium' | 'strong';
}

export const passwordRequirements = [
  {
    id: 'minLength',
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
    met: false,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter (A-Z)',
    test: (password: string) => /[A-Z]/.test(password),
    met: false,
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter (a-z)',
    test: (password: string) => /[a-z]/.test(password),
    met: false,
  },
  {
    id: 'number',
    label: 'One number (0-9)',
    test: (password: string) => /[0-9]/.test(password),
    met: false,
  },
  {
    id: 'special',
    label: 'One special character (!@#$%^&*)',
    test: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    met: false,
  },
];

export const validatePassword = (password: string): PasswordValidationResult => {
  const requirements = passwordRequirements.map(req => ({
    ...req,
    met: req.test(password),
  }));

  const metCount = requirements.filter(req => req.met).length;
  const isValid = metCount === requirements.length;

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (metCount >= 5) {
    strength = 'strong';
  } else if (metCount >= 3) {
    strength = 'medium';
  }

  return {
    isValid,
    requirements,
    strength,
  };
};
