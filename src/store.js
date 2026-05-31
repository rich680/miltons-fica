// Central in-memory store — shared across all components via context

export const USERS = [
  { id: 1, name: 'MM Admin', email: 'admin@miltons.law.za', password: 'Miltons@2026', role: 'manager' },
  { id: 2, name: 'Demo Agent', email: 'agent@miltons.law.za', password: 'Agent@2026', role: 'agent' },
]

export const RISK_CRITERIA = [
  { id: 'clientType',    label: 'Client Type',            weight: 20 },
  { id: 'txType',        label: 'Transaction Type',        weight: 20 },
  { id: 'geoRisk',       label: 'Geographic Risk',         weight: 15 },
  { id: 'sourceOfFunds', label: 'Source of Funds',         weight: 20 },
  { id: 'pepStatus',     label: 'PEP Status',              weight: 15 },
  { id: 'bizRelation',   label: 'Business Relationship',   weight: 10 },
]

export const RISK_OPTIONS = {
  clientType:    [{ label: 'Individual SA', score: 1 }, { label: 'Individual Foreign', score: 2 }, { label: 'Company / CC', score: 2 }, { label: 'Trust', score: 3 }],
  txType:        [{ label: 'Residential Purchase', score: 1 }, { label: 'Commercial Purchase', score: 2 }, { label: 'Rental', score: 1 }, { label: 'Off-plan / Development', score: 3 }],
  geoRisk:       [{ label: 'Domestic (ZA)', score: 1 }, { label: 'SADC', score: 2 }, { label: 'High-risk country', score: 3 }],
  sourceOfFunds: [{ label: 'Salary / Employment', score: 1 }, { label: 'Business Income', score: 2 }, { label: 'Inheritance / Gift', score: 2 }, { label: 'Unknown', score: 3 }],
  pepStatus:     [{ label: 'Not a PEP', score: 1 }, { label: 'Related to PEP', score: 2 }, { label: 'Is a PEP', score: 3 }],
  bizRelation:   [{ label: 'Existing Client', score: 1 }, { label: 'Referred', score: 2 }, { label: 'Walk-in / Cold', score: 3 }],
}

export const DOC_LIST = [
  'SA ID / Passport',
  'Proof of Address (<=3 months)',
  'Source of Funds Declaration',
  'FIC Questionnaire',
]

export const INITIAL_CLIENTS = [
  {
    id: 1,
    name: 'John Smith',
    idNumber: '8001015009087',
    type: 'Individual SA',
    agentId: 2,
    createdAt: '2026-03-01',
  },
  {
    id: 2,
    name: 'Sunset Properties (Pty) Ltd',
    idNumber: '2018/123456/07',
    type: 'SA Company / CC',
    agentId: 1,
    createdAt: '2026-04-15',
  },
]

export const INITIAL_TRANSACTIONS = [
  {
    id: 1,
    type: 'Residential Purchase',
    property: '14 Oak Avenue, Sandton',
    value: 3200000,
    status: 'In Progress',
    agentId: 2,
    createdAt: '2026-03-05',
  },
]

export const INITIAL_PARTIES = [
  {
    id: 1,
    transactionId: 1,
    clientId: 1,
    clientName: 'John Smith',
    clientIdNumber: '8001015009087',
    clientType: 'Individual SA',
    role: 'Buyer',
    ficStatus: 'clear',
    unStatus: 'clear',
    pepStatus: 'clear',
    adverseMediaStatus: 'clear',
    pepAuthStatus: null,
    riskScore: null,
    riskRating: null,
    riskCriteria: {},
    screeningNotes: '',
    reviewDate: null,
    docs: {},
    docFiles: {},
    ubos: [],
    screeningDate: '2026-03-10',
    createdAt: '2026-03-05',
  },
]
