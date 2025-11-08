# Contributing to No Bhad Codes

Thank you for your interest in contributing to No Bhad Codes! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm 8+
- Git
- Basic knowledge of TypeScript, Express.js, and modern web development

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork via GitHub UI, then clone your fork:
   git clone https://github.com/YOUR-USERNAME/no-bhad-codes.git
   cd no-bhad-codes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your development environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local settings
   ```

4. **Start development servers**
   ```bash
   npm run dev:full  # Starts both frontend and backend
   ```

5. **Run tests**
   ```bash
   npm run test
   npm run test:e2e
   ```

## 📋 Development Workflow

### Branch Strategy
- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/***: Feature development branches
- **bugfix/***: Bug fix branches
- **hotfix/***: Critical production fixes

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style guidelines
   - Write tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Code Standards

### TypeScript Guidelines
- **Strict Mode**: All code must pass TypeScript strict compilation
- **Type Safety**: Prefer explicit types over `any`
- **Interfaces**: Use interfaces for object shapes
- **Enums**: Use const assertions for static data

```typescript
// Good
interface UserData {
  id: string;
  name: string;
  email: string;
}

// Avoid
function handleUser(user: any) {
  // ...
}
```

### Code Style
- **ESLint**: Follow the configured ESLint rules
- **Prettier**: All code must be formatted with Prettier
- **Naming Conventions**:
  - Variables: `camelCase`
  - Functions: `camelCase`
  - Classes: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.ts`

### Architecture Patterns
- **Dependency Injection**: Use the container for service management
- **Module Pattern**: Extend `BaseModule` for UI modules
- **Service Layer**: Keep business logic in services
- **Configuration**: Use centralized constants and configuration files

```typescript
// Good - Following established patterns
export class NewFeatureModule extends BaseModule {
  protected async onInit(): Promise<void> {
    // Initialization logic
  }
  
  protected onDestroy(): void {
    // Cleanup logic
  }
}
```

## 🧪 Testing Guidelines

### Unit Tests (Vitest)
- Write tests for all new functions and classes
- Aim for >80% test coverage
- Use descriptive test names
- Mock external dependencies

```typescript
// Good test structure
describe('AuthService', () => {
  describe('login', () => {
    it('should successfully authenticate with valid credentials', async () => {
      // Arrange
      const authService = new AuthService();
      const credentials = { email: 'test@example.com', password: 'password123' };
      
      // Act
      const result = await authService.login(credentials);
      
      // Assert
      expect(result.success).toBe(true);
    });
  });
});
```

### E2E Tests (Playwright)
- Test critical user journeys
- Test across different browsers
- Include mobile responsive tests
- Test accessibility features

### Test Commands
```bash
npm run test         # Unit tests in watch mode
npm run test:run     # Run unit tests once
npm run test:coverage # Generate coverage report
npm run test:e2e     # End-to-end tests
```

## 📚 Documentation

### Code Documentation
- **JSDoc**: Document all public functions and classes
- **Type Definitions**: Export types from dedicated files
- **README Updates**: Update relevant documentation for new features

```typescript
/**
 * Authenticates a user with email and password
 * @param credentials - User login credentials
 * @returns Promise resolving to authentication result
 * @throws AuthenticationError when credentials are invalid
 */
async login(credentials: LoginCredentials): Promise<AuthResult> {
  // Implementation
}
```

### Architecture Documentation
- Update `ARCHITECTURE.md` for structural changes
- Document new design patterns or conventions
- Include examples for complex implementations

## 🐛 Bug Reports

### Before Submitting
1. Check existing issues for duplicates
2. Verify the bug in the latest version
3. Test in multiple browsers/environments
4. Gather relevant system information

### Bug Report Template
```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Navigate to...
2. Click on...
3. Observe...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120.0]
- Node.js: [e.g., 18.17.0]
- npm: [e.g., 9.6.7]
```

## ✨ Feature Requests

### Feature Request Template
```markdown
## Feature Description
Clear description of the proposed feature

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How do you envision this feature working?

## Alternatives Considered
What other solutions have you considered?

## Additional Context
Screenshots, mockups, or related examples
```

## 📦 Pull Request Process

### Before Submitting
1. **Code Quality Checks**
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

2. **Documentation**
   - Update README if needed
   - Add JSDoc comments
   - Update CHANGELOG.md

3. **Testing**
   - Add tests for new functionality
   - Ensure all tests pass
   - Test manually in browser

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed
- [ ] Browser compatibility tested

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## 🔧 Development Tips

### Debugging
- Use browser DevTools for frontend debugging
- Use `console.log` statements strategically
- Leverage TypeScript strict mode for early error detection
- Use the debug utilities: `window.NBW_DEBUG` in development

### Performance
- Monitor bundle size with `npm run build:analyze`
- Test Core Web Vitals with the performance service
- Use lazy loading for large modules
- Optimize images and assets

### Security
- Never commit sensitive data (API keys, passwords)
- Validate all user inputs
- Use the sanitization utilities for user content
- Follow OWASP security guidelines

## 🎯 Contribution Areas

### High Priority
- [ ] Expanding test coverage
- [ ] Improving accessibility features
- [ ] Performance optimizations
- [ ] Mobile responsive improvements
- [ ] Documentation enhancements

### New Features
- [ ] Email notification system
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] File version control system
- [ ] Team collaboration features

### Technical Improvements
- [ ] Database migration system
- [ ] Redis caching integration
- [ ] Docker containerization
- [ ] CI/CD pipeline setup
- [ ] Automated security scanning

## 🤝 Community

### Communication
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

### Code of Conduct
- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Maintain professional communication

## 📞 Getting Help

### Resources
- **Documentation**: Check `/docs` folder
- **Examples**: Look at existing code patterns
- **Tests**: Reference existing test files
- **Architecture**: Review `ARCHITECTURE.md`

### Contact
- **Issues**: Create a GitHub issue
- **Questions**: Use GitHub Discussions
- **Email**: noelle@nobhadcodes.com (for security issues)

## 📈 Recognition

Contributors will be:
- Added to the contributors list in README.md
- Mentioned in release notes for significant contributions
- Credited in the project's documentation

---

Thank you for contributing to No Bhad Codes! Your efforts help make this project better for everyone. 🎉