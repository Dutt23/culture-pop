import { Link } from 'react-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { Page } from '../../components/ui/Page';

export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <EmptyState title="This page doesn't exist">
        <Link to="/discover">Back to Discover</Link>
      </EmptyState>
    </Page>
  );
}
