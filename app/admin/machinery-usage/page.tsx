import { Suspense } from 'react';

import AdminMachineryUsageClient from './machinery-usage-client';

export default function AdminMachineryUsagePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading machinery analytics...</div>}>
      <AdminMachineryUsageClient />
    </Suspense>
  );
}
  Settings,
