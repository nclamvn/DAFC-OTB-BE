export const PERMISSIONS = {
  BUDGET: {
    READ: 'budget:read',
    WRITE: 'budget:write',
    APPROVE: 'budget:approve',
    SUBMIT: 'budget:submit',
  },
  PLANNING: {
    READ: 'planning:read',
    WRITE: 'planning:write',
    APPROVE: 'planning:approve',
    SUBMIT: 'planning:submit',
  },
  PROPOSAL: {
    READ: 'proposal:read',
    WRITE: 'proposal:write',
    APPROVE: 'proposal:approve',
    SUBMIT: 'proposal:submit',
  },
  TICKET: {
    READ: 'ticket:read',
    WRITE: 'ticket:write',
    APPROVE: 'ticket:approve',
  },
  APPROVAL: {
    READ: 'approval:read',
    WRITE: 'approval:write',
  },
} as const;
