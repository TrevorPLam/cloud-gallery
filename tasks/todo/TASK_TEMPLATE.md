# CloudVault Task Template

**Created:** February 5, 2026  
**Purpose:** Standardized template for AI-executable tasks  
**Usage:** Copy this template for new tasks and customize sections

---

## Template Structure

```markdown
### [Number]. [Title]

**Task ID:** TASK-XXX
**Title:** [Brief descriptive title]
**Priority:** P[0-3] - [Category]
**Status:** [🔵 Not Started / 🚀 In Progress / ✅ Complete]
**Agent/Human:** [AGENT/HUMAN]
**Estimated Effort:** [Hours] - [Complexity: Low/Medium/High]

**AI Guardrails:**

- [ ] Maximum execution time: [hours/minutes]
- [ ] File modification limits: [max files per session]
- [ ] Database change restrictions: [read-only vs write allowed]
- [ ] External API call limits: [max calls per task]
- [ ] Safety check intervals: [check every N operations]

**Validation Checkpoints:**

- [ ] Pre-commit validation: [specific checks before major changes]
- [ ] Mid-implementation verification: [checkpoints during development]
- [ ] Post-implementation testing: [comprehensive validation steps]
- [ ] Performance regression checks: [benchmarks to maintain]
- [ ] Security validation points: [security checks at key stages]

**Context Preservation:**

- [ ] Critical state snapshots: [what to preserve before changes]
- [ ] Rollback triggers: [conditions that require automatic rollback]
- [ ] State validation points: [how to verify system state]
- [ ] Dependency state tracking: [track changes to dependent systems]
- [ ] Configuration baseline: [reference configuration to maintain]

**Decision Logic:**

- [ ] If [condition] then [action] else [alternative]
- [ ] Error handling branches: [specific error responses]
- [ ] Performance thresholds: [when to choose alternative approaches]
- [ ] Security level branches: [different implementations based on security requirements]
- [ ] Environment-specific paths: [dev vs staging vs production differences]

**Anti-Patterns to Avoid:**

- [ ] Never: [specific anti-pattern with explanation]
- [ ] Avoid: [common mistakes with consequences]
- [ ] Warning: [potential issues with mitigation]
- [ ] Deprecated: [old patterns to avoid]
- [ ] Security risk: [dangerous practices to prevent]

**Quality Gates:**

- [ ] Code coverage threshold: [minimum % required]
- [ ] Performance benchmarks: [maximum acceptable times]
- [ ] Security scan requirements: [vulnerability thresholds]
- [ ] Documentation completeness: [required docs before completion]
- [ ] Test automation: [automated tests that must pass]

**Integration Points:**

- [ ] API contracts: [specific interfaces to maintain]
- [ ] Database schema constraints: [schema compatibility requirements]
- [ ] External service dependencies: [third-party integration requirements]
- [ ] Client compatibility: [frontend/backend contract requirements]
- [ ] Deployment dependencies: [infrastructure requirements]

**Monitoring Requirements:**

- [ ] Performance metrics: [key performance indicators]
- [ ] Error rate thresholds: [acceptable error levels]
- [ ] Security event monitoring: [security events to track]
- [ ] Resource usage limits: [memory, CPU, storage limits]
- [ ] User experience metrics: [UX indicators to monitor]

**Pre-conditions:**

- [ ] System state requirements
- [ ] Dependencies must be completed
- [ ] Required tools/environment

**AI Execution Context:**

- [ ] Key files to reference: [file paths]
- [ ] Relevant patterns: [pattern names]
- [ ] Similar implementations: [references]

**Acceptance Requirements:**

- [ ] Specific, measurable requirements
- [ ] User-facing functionality
- [ ] Technical specifications

**Files to Create/Modify:**

- [ ] Create: [file paths]
- [ ] Modify: [file paths with specific changes]

**Code Components:**

- [ ] [Function/component name] - [brief description]
- [ ] [Function/component name] - [brief description]

**Verification Commands:**

- [ ] `npm test` - Verify all tests pass
- [ ] `npm run lint` - Verify code quality
- [ ] [specific command] - Verify feature works

**Rollback Procedures:**

- [ ] How to undo database changes
- [ ] How to revert file modifications
- [ ] How to restore previous state

**Testing Requirements:**

- [ ] Unit tests for [specific functions]
- [ ] Integration tests for [workflows]
- [ ] Manual testing procedures

**Safety Constraints:**

- [ ] Security considerations
- [ ] Data protection requirements
- [ ] Performance limitations

**Dependencies:**

- [ ] TASK-XXX must be completed
- [ ] External dependencies
- [ ] System requirements

**Implementation Steps:**

- [ ] Step 1 with specific action
- [ ] Step 2 with specific action

**Success Metrics:**

- [ ] Quantifiable measure 1
- [ ] Quantifiable measure 2

**Blockers:**

- [ ] Current blockers preventing start
- [ ] Dependencies on other tasks

**Cost Analysis:**

- **Implementation Cost:** $[amount] ([hours] hours development)
- **Tools & Dependencies:** $[amount]
- **Ongoing Maintenance:** $[amount]/year
- **ROI:** [Business value]

---
```

---

## Component Guidelines

### **Required Components**
- **Task ID**, **Title**, **Priority**, **Status**, **Agent/Human**
- **Estimated Effort** - Critical for AI planning
- **AI Guardrails** - Execution limits and safety constraints
- **Validation Checkpoints** - Quality verification at key stages
- **Context Preservation** - State management and rollback triggers
- **Decision Logic** - Branching logic for different scenarios
- **Anti-Patterns to Avoid** - Common mistakes and warnings
- **Quality Gates** - Minimum quality standards
- **Integration Points** - System dependencies and contracts
- **Monitoring Requirements** - Performance and security monitoring
- **Pre-conditions** - System state before starting
- **AI Execution Context** - Files, patterns, references
- **Acceptance Requirements** - Measurable success criteria
- **Files to Create/Modify** - Specific file paths
- **Code Components** - Functions/components to implement
- **Verification Commands** - Commands to validate completion
- **Rollback Procedures** - How to undo changes
- **Testing Requirements** - Test coverage requirements
- **Safety Constraints** - Security and performance limits
- **Dependencies** - Tasks and external requirements
- **Implementation Steps** - Step-by-step actions
- **Success Metrics** - Quantifiable measures
- **Blockers** - Current impediments

### **Optional Components**
- **Cost Analysis** - For business justification
- **Configuration Schema** - For configuration tasks
- **Security Parameters** - For security tasks
- **Error Handling** - For error-prone tasks
- **Performance Benchmarks** - For performance-critical tasks

---

## Priority Levels

- **P0** - Critical security/foundation, must complete first
- **P1** - Important features, high business value
- **P2** - Nice-to-have features, medium business value
- **P3** - Future enhancements, low business value

---

## Status Indicators

- **🔵 Not Started** - Ready to begin
- **🚀 In Progress** - Currently being worked on
- **✅ Complete** - Finished and tested
- **🚫 Blocked** - Waiting on dependencies

---

## Complexity Levels

- **Low** - Simple implementation, well-understood patterns
- **Medium** - Moderate complexity, some new patterns
- **High** - Complex implementation, requires research/testing

---

## AI Execution Best Practices

### **Pre-conditions**
- List all system requirements before starting
- Identify dependencies on other tasks
- Specify required tools and environment setup

### **AI Execution Context**
- Reference specific files for patterns
- Mention similar implementations
- Include relevant architectural patterns

### **Verification Commands**
- Provide exact commands to run
- Include test commands for validation
- Add manual testing procedures

### **Rollback Procedures**
- Document how to undo each change
- Include database rollback steps
- Specify file restoration procedures

### **Success Metrics**
- Use quantifiable measures
- Include performance benchmarks
- Add quality metrics (coverage, etc.)

---

## Example Usage

See existing tasks for examples:
- **TASK-004** - Security implementation with comprehensive testing
- **TASK-005** - Complex feature with database changes
- **TASK-006** - Configuration management with validation

---

## Quality Checklist

Before marking a task as complete:

- [ ] All acceptance requirements are met
- [ ] All verification commands pass
- [ ] Test coverage meets requirements
- [ ] Safety constraints are respected
- [ ] Success metrics are achieved
- [ ] Documentation is updated
- [ ] Rollback procedures are tested

---

**Last Updated:** February 5, 2026  
**Maintained By:** CloudVault Development Team  
**Questions?** See [AGENTS.md](../AGENTS.md) for AI development guidelines

---
