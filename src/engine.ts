export const calculateMaturity = (score: number): 'Frio' | 'Morno' | 'Quente' | 'Não Classificado' => {
  if (score === 0) return 'Não Classificado';
  if (score < 10) return 'Frio';
  if (score >= 10 && score < 20) return 'Morno';
  return 'Quente';
};
