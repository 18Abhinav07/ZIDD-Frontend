"use client";

import { useParams } from 'next/navigation';
import { SchoolTutorWorkspace } from '@/components/school/tutor/SchoolTutorWorkspace';

export default function SchoolTutorSessionPage() {
  const params = useParams<{ sessionId: string }>();

  return <SchoolTutorWorkspace sessionId={params.sessionId} />;
}
