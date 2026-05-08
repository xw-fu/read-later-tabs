import { describe, it, expect } from 'vitest';
import { parseHeaders } from '../../../src/lib/recommender/headers';

describe('parseHeaders', () => {
  it('returns empty object for empty string', () => {
    expect(parseHeaders('')).toEqual({});
  });

  it('returns empty object for whitespace-only and blank lines', () => {
    expect(parseHeaders('   \n\n  \n')).toEqual({});
  });

  it('parses a single header', () => {
    expect(parseHeaders('X-Foo: bar')).toEqual({ 'X-Foo': 'bar' });
  });

  it('parses multiple headers', () => {
    expect(parseHeaders('X-A: 1\nX-B: 2')).toEqual({ 'X-A': '1', 'X-B': '2' });
  });

  it('only splits on first colon (value may contain colons)', () => {
    expect(parseHeaders('Authorization: Bearer abc:def')).toEqual({
      Authorization: 'Bearer abc:def',
    });
  });

  it('trims whitespace around name and value', () => {
    expect(parseHeaders('  X-Foo  :   bar  ')).toEqual({ 'X-Foo': 'bar' });
  });

  it('later duplicate name wins', () => {
    expect(parseHeaders('X-Foo: a\nX-Foo: b')).toEqual({ 'X-Foo': 'b' });
  });

  it('silently drops malformed lines (no colon)', () => {
    expect(parseHeaders('X-Foo: bar\nbroken-line\nX-Baz: qux')).toEqual({
      'X-Foo': 'bar',
      'X-Baz': 'qux',
    });
  });
});
