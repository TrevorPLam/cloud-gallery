# Agentic Coding Guidelines

1. What is Agentic Coding?
Agentic coding is a development workflow in which autonomous AI agents plan, write, test, and modify code with minimal human intervention. The “agentic” aspect refers to the agent’s ability to make decisions about how to accomplish a given goal, using tools (editors, linters, version control, etc.) and feedback loops.

2. Core Fundamentals
Task Decomposition: The agent must break high‑level requests into subtasks (e.g., “add CSRF protection” → generate token, add middleware, update client, write tests).

Context Management: The agent must keep track of relevant context (project structure, existing code, dependencies) within token limits.

Tool Use: The agent must know which tools are available (file system, package manager, test runner, git) and when to use them.

Feedback Loops: The agent must interpret test results, lint errors, and human feedback to iterate toward a correct solution.

State Persistence: The agent should remember what it has already done to avoid repeated work.

3. Best Practices for Task Management
Write Smart Specs: Tasks should be described as outcomes, not step‑by‑step instructions. Example: “Ensure all state‑changing API endpoints reject requests without a valid CSRF token” rather than “create a file called csrf.ts with these 50 lines.”

Modularize Tasks: Keep tasks small and focused. A task that takes more than a few hours for an agent is likely too broad.

Provide Clear Acceptance Criteria: Define exactly how to verify success (e.g., “all tests pass,” “coverage remains above 80%,” “no new lint errors”).

List Safety Constraints Explicitly: What the agent must never change (e.g., encryption algorithms, auth flows). Use a “NEVER change” section.

Give Contextual Hints: Point to related files, existing patterns, or similar implementations in the codebase.

Set Quality Gates: Require tests, linting, and formatting checks before a task is considered complete.

Human‑in‑the‑Loop for Critical Decisions: Require human review for security‑sensitive changes, schema migrations, or major architecture shifts.

4. Highest Standards (What “Excellent” Looks Like)
Robustness: The agent handles edge cases, network failures, and partial failures gracefully.

Security: The agent automatically applies security best practices (input validation, parameterized queries, secure defaults) without being told.

Scalability: The agent considers performance implications (database queries, memory usage) when implementing features.

Maintainability: The agent writes clean, well‑documented code that follows the project’s conventions.

Auditability: The agent logs its actions and decisions in a way that allows humans to understand what it did and why.

5. Unique & Novel Approaches
Multi‑Agent Systems: Different specialized agents (frontend, backend, security, testing) collaborate on a task, each with its own expertise.

Self‑Improving Agents: Agents that analyze their own performance, learn from mistakes, and update their strategies over time.

Domain‑Specific Agents: Agents pre‑trained or fine‑tuned on a particular technology stack (e.g., React + Node.js + PostgreSQL) that understand the common patterns and pitfalls of that stack.

Agentic Workflows: Orchestrated pipelines where one agent writes code, another reviews it, a third runs tests, and a fourth deploys—all automatically.

Spec‑Driven Development: Agents that generate code from formal specifications (e.g., OpenAPI specs, type definitions) and keep the code in sync with the spec.

# Required Task Components 
1. Task ID & Title
2. Priority Level 
3. Status Indicators: Not Started, In Progress, Complete
4. Acceptance Requirements
5. Files to Create/Modify
6. Code Components (functions, endpoints)
7. Testing Requirements
8. Safety Constraints 
9. Dependencies 
10. Detailed Implementation Steps 
11. AGENT or HUMAN designation 