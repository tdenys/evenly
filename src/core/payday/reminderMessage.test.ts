import { describeReminderBody } from './reminderMessage';

describe('describeReminderBody', () => {
  it('message positif si rien en attente', () => {
    expect(describeReminderBody([])).toBe('Tous tes virements sont déjà faits ce mois-ci ✓');
  });

  it('singulier pour 1 virement en attente, avec son détail', () => {
    expect(describeReminderBody([{ label: '🏠 Besoins', formattedAmount: '800.00 €' }])).toBe(
      '1 virement à faire\n🏠 Besoins : 800.00 €'
    );
  });

  it('pluriel pour plusieurs virements en attente, une ligne de détail par virement', () => {
    const pending = [
      { label: '🏠 Besoins', formattedAmount: '800.00 €' },
      { label: '✈️ Voyage', formattedAmount: '250.00 €' },
      { label: '📈 PEA', formattedAmount: '300.00 €' },
    ];
    expect(describeReminderBody(pending)).toBe(
      '3 virements à faire\n🏠 Besoins : 800.00 €\n✈️ Voyage : 250.00 €\n📈 PEA : 300.00 €'
    );
  });
});
