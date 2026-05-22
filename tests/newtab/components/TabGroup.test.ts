import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { installChromeMock } from '../../helpers/mock-chrome';
import TabGroup from '../../../src/newtab/components/TabGroup.svelte';

beforeEach(() => {
  installChromeMock();
});

describe('TabGroup heading', () => {
  it('renders title and count', () => {
    const { container } = render(TabGroup, {
      props: {
        title: 'Open',
        tabs: [],
        onClickTab: () => {},
        onVerdict: () => {},
        onArchive: () => {},
      },
    });
    expect(container.textContent).toContain('Open');
    expect(container.textContent).toContain('共 0 张');
  });
});
