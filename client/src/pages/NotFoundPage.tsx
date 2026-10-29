import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/states';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <>
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={Compass}
        title="404: this page doesn’t exist"
        description="The link may be broken, or the page may have moved. Let’s get you back on track."
        action={
          <Button asChild>
            <Link to="/">Start a new scan</Link>
          </Button>
        }
        className="py-24"
      />
    </>
  );
}
