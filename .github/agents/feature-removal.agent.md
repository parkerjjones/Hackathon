---
name: feature-removal
description: "Use when: removing deprecated features, components, or subsystems from a codebase. Systematically cleans up imports, state management, UI components, server endpoints, documentation, and fixes compilation errors."
version: "1.0"
tools:
  - name: grep_search
    description: "Essential for finding all references to the feature being removed"
  - name: read_file
    description: "Read files to understand dependencies and usage"
  - name: replace_string_in_file
    description: "Edit files to remove code, update types, fix imports"
  - name: run_in_terminal
    description: "Run builds/tests to validate changes"
  - name: list_dir
    description: "Check file structure"
  - name: semantic_search
    description: "Find related code"
---

# Feature Removal Agent

This agent specializes in safely removing features or components from a codebase. It follows a systematic approach:

1. **Identify all components**: Files, imports, state, handlers, UI elements, server routes
2. **Remove files**: Delete component files, hooks, types
3. **Update code**: Remove imports, state variables, handlers, render calls
4. **Fix types**: Update interfaces, remove union types
5. **Update documentation**: README, comments, architecture diagrams
6. **Validate**: Build and test to ensure no broken references

## When to Use

- Removing deprecated UI components
- Eliminating unused features
- Cleaning up after feature flags are removed
- Refactoring out entire subsystems

## Example Usage

"Remove all CCTV components from the project"

The agent will:
- Find all CCTV-related files and code references
- Remove them systematically
- Update all dependent code
- Fix compilation errors
- Update documentation