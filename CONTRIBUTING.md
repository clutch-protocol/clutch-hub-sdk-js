# Contributing to Clutch Hub SDK JS

Thank you for your interest in contributing to Clutch Hub SDK JS! We welcome contributions from the community and appreciate your help in making this project better.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please report unacceptable behavior to mehran.mazhar@gmail.com.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue tracker to avoid duplicates. When creating a bug report, please include:

- A clear and descriptive title
- A detailed description of the issue
- Steps to reproduce the problem
- Code examples that demonstrate the issue
- Expected behavior vs. actual behavior
- Your environment details (Node.js version, browser, OS, etc.)
- Any relevant error messages

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- A clear and descriptive title
- A detailed description of the proposed SDK feature
- Explain why this enhancement would be useful
- Include code examples if possible
- Consider backward compatibility

### Code Contributions

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure tests pass (`npm test`)
6. Run linting (`npm run lint`)
7. Build the project (`npm run build`)
8. Test with demo applications if possible
9. Commit your changes (`git commit -m 'Add some amazing feature'`)
10. Push to the branch (`git push origin feature/amazing-feature`)
11. Open a Pull Request

### Development Setup

1. Install Node.js (16+)
2. Clone your fork
3. Run `npm install` to install dependencies
4. Run `npm run build` to compile TypeScript
5. Run `npm test` to run tests
6. Run `npm run lint` to check code style

## Style Guidelines

### TypeScript/JavaScript Code Style

- Follow the existing code style
- Use TypeScript for all new code
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Follow naming conventions (camelCase for variables, PascalCase for classes)
- Keep functions focused and small
- Use proper error handling

### API Design

- Keep the SDK interface simple and intuitive
- Use consistent naming conventions
- Provide clear error messages
- Support both Promise and async/await patterns
- Include proper TypeScript types
- Make methods chainable where appropriate

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Testing

- Write unit tests for all new functionality
- Write integration tests where appropriate
- Test error handling scenarios
- Ensure existing tests continue to pass
- Test with different Node.js versions
- Include browser compatibility tests if applicable

## Documentation

- Update README.md with new features
- Include code examples in documentation
- Add JSDoc comments for all public methods
- Update TypeScript type definitions
- Keep examples up to date

## Security Considerations

- Never expose private keys in examples
- Validate all inputs
- Use secure random number generation
- Follow cryptographic best practices
- Consider client-side security implications
- Document security best practices for users

## Browser Compatibility

- Test in major browsers (Chrome, Firefox, Safari, Edge)
- Consider mobile browser compatibility
- Use appropriate polyfills if needed
- Document browser requirements

## Performance Considerations

- Keep bundle size minimal
- Use lazy loading where appropriate
- Optimize cryptographic operations
- Consider memory usage in long-running applications
- Profile performance-critical code paths

## Review Process

1. All submissions require review
2. Reviewers will check for:
   - Code quality and style
   - API design consistency
   - Test coverage
   - Documentation completeness
   - Security considerations
   - Performance implications
   - Browser compatibility

## Recognition

Contributors will be recognized in our README and releases. Thank you for helping make Clutch Hub SDK JS better!

## Questions?

Feel free to contact us at mehran.mazhar@gmail.com or open an issue for discussion.
