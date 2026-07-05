export interface ExpenseLike {
  payerId: string;
  amount: number;
}

export interface SettlementLike {
  fromUser: string;
  toUser: string;
  amount: number;
}

export type Balance =
  | { status: 'settled'; amount: 0 }
  | { status: 'owed_to_me'; amount: number }
  | { status: 'i_owe'; amount: number };

const toCents = (value: number) => Math.round(value * 100);

/**
 * Net 50/50 balance between `meId` and `partnerId`.
 * Positive amounts owed flow from whoever spent less toward whoever spent more,
 * then settlements are applied to reduce (or reverse) that debt.
 */
export function calculateBalance(
  meId: string,
  partnerId: string,
  expenses: ExpenseLike[],
  settlements: SettlementLike[]
): Balance {
  let netCents = 0;

  for (const expense of expenses) {
    const cents = toCents(expense.amount);
    if (expense.payerId === meId) netCents += cents;
    else if (expense.payerId === partnerId) netCents -= cents;
  }

  netCents = netCents / 2;

  for (const settlement of settlements) {
    const cents = toCents(settlement.amount);
    if (settlement.fromUser === partnerId && settlement.toUser === meId) netCents -= cents;
    else if (settlement.fromUser === meId && settlement.toUser === partnerId) netCents += cents;
  }

  const amount = Math.round(netCents) / 100;

  if (Math.abs(amount) < 0.01) return { status: 'settled', amount: 0 };
  if (amount > 0) return { status: 'owed_to_me', amount };
  return { status: 'i_owe', amount: Math.abs(amount) };
}
