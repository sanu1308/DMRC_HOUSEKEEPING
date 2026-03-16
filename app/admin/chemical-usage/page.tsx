import { Suspense } from 'react';

import ChemicalUsageClient from './chemical-usage-client';

export default function ChemicalUsagePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading chemical usage...</div>}>
      <ChemicalUsageClient />
    </Suspense>
  );
}