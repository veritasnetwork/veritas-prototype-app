import { BeliefSubmissionWizard } from '@/components/belief-submission/BeliefSubmissionWizard';

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">Submit Belief</h1>
        <BeliefSubmissionWizard />
      </div>
    </div>
  );
}
