export const userAdditionalFields = {
  requestedRole: { type: 'string', required: false, input: true },
  orgName: { type: 'string', required: false, input: true },
  orgType: { type: 'string', required: false, input: true },
  businessName: { type: 'string', required: false, input: true },
  businessCategory: { type: 'string', required: false, input: true },
  businessDescription: { type: 'string', required: false, input: true },
  // Ticked or not at sign-up; changed later through account.profile.
  marketingOptIn: {
    type: 'boolean',
    required: false,
    input: true,
    defaultValue: false,
  },
} as const
