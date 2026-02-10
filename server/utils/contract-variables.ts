/**
 * Contract variable resolution helpers.
 */

type ContractVariableSource = {
  client?: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
  };
  project?: {
    name?: string | null;
    type?: string | null;
    description?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    price?: number | string | null;
    depositAmount?: number | string | null;
  };
  business?: {
    name?: string | null;
    owner?: string | null;
    contact?: string | null;
    email?: string | null;
    website?: string | null;
  };
  date?: {
    today?: string | null;
  };
};

const DEFAULT_VARIABLES = [
  'client.name',
  'client.email',
  'client.company',
  'project.name',
  'project.type',
  'project.description',
  'project.start_date',
  'project.due_date',
  'project.price',
  'project.deposit_amount',
  'business.name',
  'business.owner',
  'business.contact',
  'business.email',
  'business.website',
  'date.today'
];

export function getDefaultContractVariables(): string[] {
  return [...DEFAULT_VARIABLES];
}

export function resolveContractVariables(source: ContractVariableSource): Record<string, string> {
  const today = source.date?.today || new Date().toISOString().split('T')[0];
  const formatMoney = (value?: number | string | null): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  return {
    'client.name': source.client?.name || '',
    'client.email': source.client?.email || '',
    'client.company': source.client?.company || '',
    'project.name': source.project?.name || '',
    'project.type': source.project?.type || '',
    'project.description': source.project?.description || '',
    'project.start_date': source.project?.startDate || '',
    'project.due_date': source.project?.dueDate || '',
    'project.price': formatMoney(source.project?.price),
    'project.deposit_amount': formatMoney(source.project?.depositAmount),
    'business.name': source.business?.name || '',
    'business.owner': source.business?.owner || '',
    'business.contact': source.business?.contact || '',
    'business.email': source.business?.email || '',
    'business.website': source.business?.website || '',
    'date.today': today
  };
}

export function applyContractVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}
