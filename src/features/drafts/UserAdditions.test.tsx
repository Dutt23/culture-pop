import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UserAdditions, type UserLink } from './UserAdditions';

function Harness() {
  const [context, setContext] = useState('');
  const [links, setLinks] = useState<UserLink[]>([]);
  return (
    <UserAdditions
      context={context}
      onContextChange={setContext}
      links={links}
      onAddLink={(link) => setLinks([...links, link])}
      onRemoveLink={(url) => setLinks(links.filter((link) => link.url !== url))}
    />
  );
}

describe('UserAdditions', () => {
  it('keeps context visibly separate and adds/removes a source link', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Added by you · context has not been verified')).toBeInTheDocument();
    const context = screen.getByRole('textbox', { name: 'Your context or text' });
    expect(context).toHaveAttribute('maxlength', '1200');
    await user.type(context, 'My own interpretation.');
    expect(context).toHaveValue('My own interpretation.');
    await user.type(
      screen.getByRole('textbox', { name: 'Your source link' }),
      'https://example.com/source',
    );
    await user.type(screen.getByRole('textbox', { name: 'Link title (optional)' }), 'An example');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByRole('list', { name: 'Links added by you' })).toHaveTextContent(
      'An example',
    );
    await user.click(screen.getByRole('button', { name: 'Remove An example' }));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it.each(['http://example.com', 'https://user:password@example.com'])(
    'rejects unsafe URL %s',
    async (url) => {
      const add = vi.fn();
      render(
        <UserAdditions
          context=""
          onContextChange={vi.fn()}
          links={[]}
          onAddLink={add}
          onRemoveLink={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'Your source link' }), {
        target: { value: url },
      });
      fireEvent.submit(screen.getByRole('button', { name: 'Add link' }).closest('form')!);
      expect(screen.getByRole('alert')).toHaveTextContent('Enter an HTTPS link');
      expect(add).not.toHaveBeenCalled();
    },
  );

  it('refuses duplicate links and more than ten links', () => {
    const add = vi.fn();
    const links = Array.from({ length: 10 }, (_, index) => ({
      url: `https://example.com/${index}`,
      title: `Source ${index}`,
    }));
    render(
      <UserAdditions
        context=""
        onContextChange={vi.fn()}
        links={links}
        onAddLink={add}
        onRemoveLink={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Your source link' });
    const form = screen.getByRole('button', { name: 'Add link' }).closest('form')!;
    fireEvent.change(input, { target: { value: links[0].url } });
    fireEvent.submit(form);
    expect(screen.getByRole('alert')).toHaveTextContent('already added');
    fireEvent.change(input, { target: { value: 'https://example.com/new' } });
    fireEvent.submit(form);
    expect(screen.getByRole('alert')).toHaveTextContent('up to 10 links');
    expect(add).not.toHaveBeenCalled();
  });
});
