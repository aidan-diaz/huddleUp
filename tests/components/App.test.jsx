import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

// Mock the Convex client
vi.mock('convex/react', () => ({
  ConvexProvider: ({ children }) => children,
  ConvexReactClient: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

describe('App', () => {
  it('renders the welcome message', () => {
    render(<App />);
    expect(screen.getByText('Welcome to HuddleUp')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<App />);
    expect(
      screen.getByText('Real-time collaboration and messaging')
    ).toBeInTheDocument();
  });
});
