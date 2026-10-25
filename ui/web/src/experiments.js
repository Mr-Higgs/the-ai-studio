export function experimentStats(experiment, rows = []) {
  const related = rows.filter(row => row.experiment === experiment.id);
  const won = related.filter(row => row.stage === 'Won');
  const revenue = won.reduce((sum, row) => {
    const value = Number(row.value);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const spent = experiment.spent == null || experiment.spent === '' ? null : Number(experiment.spent);
  return {
    leads: related.length,
    won: won.length,
    revenue,
    costPerCustomer: spent != null && Number.isFinite(spent) && won.length ? spent / won.length : null,
  };
}
