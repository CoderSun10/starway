const { yuanToFen, fenToYuanString, formatFen, parseAmountFen } = require('../../src/utils/money');

describe('yuanToFen', () => {
  test('19.99 不分误差', () => {
    expect(yuanToFen('19.99')).toBe(1999);
  });
  test('0.1 / 0.01', () => {
    expect(yuanToFen('0.1')).toBe(10);
    expect(yuanToFen('0.01')).toBe(1);
  });
  test('千分位逗号', () => {
    expect(yuanToFen('1,234.5')).toBe(123450);
  });
  test('超长整数拒绝', () => {
    expect(yuanToFen('123456789')).toBe(null);
  });
  test('0 拒绝', () => {
    expect(yuanToFen('0')).toBe(null);
  });
});

describe('formatFen', () => {
  test('整元去掉小数', () => {
    expect(formatFen(1200)).toBe('¥12');
  });
  test('分', () => {
    expect(formatFen(1234)).toBe('¥12.34');
  });
  test('千分位', () => {
    expect(formatFen(123400)).toBe('¥1,234');
  });
});

describe('parseAmountFen', () => {
  test('整数分', () => {
    expect(parseAmountFen(3200)).toBe(3200);
  });
  test('越界', () => {
    expect(parseAmountFen(0)).toBe(null);
    expect(parseAmountFen(1_000_000_001)).toBe(null);
  });
});
