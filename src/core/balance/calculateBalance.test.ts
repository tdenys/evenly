import { calculateBalance } from './calculateBalance';

const ME = 'me';
const PARTNER = 'partner';

describe('calculateBalance', () => {
  it('returns settled when nobody has spent anything', () => {
    expect(calculateBalance(ME, PARTNER, [], [])).toEqual({ status: 'settled', amount: 0 });
  });

  it('returns settled when both spent the same amount', () => {
    const expenses = [
      { payerId: ME, amount: 50 },
      { payerId: PARTNER, amount: 50 },
    ];
    expect(calculateBalance(ME, PARTNER, expenses, [])).toEqual({ status: 'settled', amount: 0 });
  });

  it('partner owes me half the gap when I spent more', () => {
    const expenses = [
      { payerId: ME, amount: 100 },
      { payerId: PARTNER, amount: 0 },
    ];
    expect(calculateBalance(ME, PARTNER, expenses, [])).toEqual({
      status: 'owed_to_me',
      amount: 50,
    });
  });

  it('I owe partner half the gap when they spent more', () => {
    const expenses = [
      { payerId: ME, amount: 0 },
      { payerId: PARTNER, amount: 100 },
    ];
    expect(calculateBalance(ME, PARTNER, expenses, [])).toEqual({
      status: 'i_owe',
      amount: 50,
    });
  });

  it('a settlement from partner to me reduces what they owe me', () => {
    const expenses = [{ payerId: ME, amount: 100 }];
    const settlements = [{ fromUser: PARTNER, toUser: ME, amount: 50 }];
    expect(calculateBalance(ME, PARTNER, expenses, settlements)).toEqual({
      status: 'settled',
      amount: 0,
    });
  });

  it('ignores expenses/settlements involving people outside the couple', () => {
    const expenses = [
      { payerId: ME, amount: 100 },
      { payerId: 'stranger', amount: 999 },
    ];
    expect(calculateBalance(ME, PARTNER, expenses, [])).toEqual({
      status: 'owed_to_me',
      amount: 50,
    });
  });
});
