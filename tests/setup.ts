import { beforeEach } from 'vitest';
import { installChromeMock, resetChromeMock } from './helpers/mock-chrome';

installChromeMock();

beforeEach(() => {
  resetChromeMock();
});
