import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";

export default function TermsPage() {
  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-rose-800">Using Her Space</p>
        <h1 className="text-3xl font-bold text-deep-plum">Terms</h1>
        <p className="leading-7 text-gray-700">By using Her Space, you agree to these simple terms.</p>
      </header>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">Use the community respectfully</h2>
        <p className="leading-7 text-gray-800">Follow the Community rules, respect other members’ privacy, and only share information you have the right to share. Do not use Her Space to harass people, sell products, or post harmful or unlawful content.</p>
      </Card>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">Health information</h2>
        <p className="leading-7 text-gray-800">Her Space shares education, not medical advice or diagnosis.</p>
        <p className="leading-7 text-gray-800">Information on the service cannot replace advice from a qualified health professional who knows your situation. If you are worried about your health, contact a health professional. In an emergency, contact local emergency services or go to the nearest health facility.</p>
      </Card>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">Your account and content</h2>
        <p className="leading-7 text-gray-800">Keep your sign-in details secure. You are responsible for what you post. You can delete your account in Settings; deletion is permanent and removes associated content.</p>
      </Card>

      <p className="text-sm leading-6 text-gray-700">Questions about these terms? Contact [your contact email]. Effective date: [date].</p>
    </PageShell>
  );
}