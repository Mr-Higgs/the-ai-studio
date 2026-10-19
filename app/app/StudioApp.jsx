'use client';

import dynamic from 'next/dynamic';

const Studio = dynamic(() => import('../src/studio/App.jsx'), { ssr: false });

export default function StudioApp() {
  return <div id="root"><Studio /></div>;
}
