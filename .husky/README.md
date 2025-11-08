# Git Hooks Configuration

This directory contains automated quality checks that run at different stages of the Git workflow.

## Available Hooks

### pre-commit
Runs before each commit to ensure code quality:
- **lint-staged**: Lints and formats only staged files for better performance
- **TypeScript check**: Ensures all types are valid
- **Unit tests**: Runs tests to catch regressions

### commit-msg
Validates commit messages to follow conventional commit format:
- Ensures commits follow the pattern: `type(scope): description`
- Enforces consistent commit history for better changelog generation

### pre-push
Comprehensive checks before pushing to remote:
- **Full linting**: Checks all files in the project
- **TypeScript compilation**: Full type checking
- **All tests**: Runs complete test suite
- **Build verification**: Ensures project builds successfully

## Conventional Commit Format

Commit messages should follow this pattern:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Reverting changes

### Examples:
```bash
feat(business-card): add flip animation
fix(contact-form): resolve validation issue
docs: update API documentation
style: fix ESLint warnings
refactor(router): simplify navigation logic
test(business-card): add interaction tests
chore: update dependencies
```

## Quality Checks

### Code Quality
- **ESLint**: JavaScript/TypeScript linting with automatic fixing
- **Prettier**: Code formatting for consistent style
- **TypeScript**: Type checking for type safety

### Testing
- **Unit Tests**: Fast tests for individual components
- **Integration Tests**: End-to-end testing with Playwright
- **Coverage Reports**: Ensures adequate test coverage

### Security
- **Dependency Audit**: Checks for known vulnerabilities
- **Private Key Detection**: Prevents accidental key commits
- **File Size Check**: Prevents large file commits

### Performance
- **Bundle Analysis**: Monitors bundle size
- **Build Verification**: Ensures optimized builds

## Bypassing Hooks (Use Sparingly)

In rare cases, you can bypass hooks:
```bash
# Skip pre-commit hooks (NOT RECOMMENDED)
git commit --no-verify -m "emergency fix"

# Skip pre-push hooks (NOT RECOMMENDED)  
git push --no-verify
```

**Warning**: Only use `--no-verify` in genuine emergencies. The hooks exist to maintain code quality and prevent issues.

## Troubleshooting

### Hook not running?
```bash
# Reinstall hooks
npm run prepare

# Check permissions
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```

### Lint-staged failures?
```bash
# Run manually to see specific issues
npx lint-staged

# Fix linting issues
npm run lint
npm run format
```

### Test failures?
```bash
# Run tests manually
npm run test

# Run specific test file
npm run test -- business-card.test.ts
```

### Type errors?
```bash
# Run type checking
npm run typecheck

# Check specific file
npx tsc --noEmit src/path/to/file.ts
```

## Configuration Files

- `.commitlintrc.json`: Commit message validation rules
- `package.json`: lint-staged configuration
- `.pre-commit-config.yaml`: Additional pre-commit hooks
- `audit-ci.json`: Security audit configuration