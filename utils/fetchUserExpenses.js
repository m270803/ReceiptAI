import { requestApi } from './api';

export const fetchUserExpenses = async (uid) => {
  if (!uid) throw new Error('A signed-in user is required to load expenses.');
  return requestApi('/api/finance/expenses', undefined, 'GET');
};
