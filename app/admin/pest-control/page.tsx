import { Suspense } from 'react';

import AdminPestControlClient from './pest-control-client';

export default function AdminPestControlPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading pest control analytics...</div>}>
      <AdminPestControlClient />
    </Suspense>
  );
}
}
