import PageShell from "@/components/ui/PageShell";
import Card from "@/components/ui/Card";

export default function RulesPage() {
  return (
    <PageShell className="max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-rose-800">Her Space community</p>
        <h1 className="text-3xl font-bold text-deep-plum">Community rules</h1>
        <p className="leading-7 text-gray-700">Help make this a kind, useful, and safer space for everyone.</p>
      </header>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">How we treat each other</h2>
        <ul className="list-disc space-y-3 pl-5 leading-7 text-gray-800">
          <li>Be kind. Respect different experiences, identities, choices, and boundaries.</li>
          <li>Respect privacy. Do not share someone else’s name, messages, photos, or personal information without permission.</li>
          <li>Share your experience, not a diagnosis. What happened to you may not be what is happening for someone else.</li>
          <li>Do not give medical instructions, tell someone to start or stop treatment, or promote unverified “cures.” Encourage people to speak with a qualified health professional.</li>
          <li>No selling or promotion of products, medications, supplements, or services.</li>
          <li>No harassment, threats, insults, or shaming about someone’s body, health, or choices.</li>
          <li>Do not post content describing methods of self-harm. Offer care and encourage immediate support instead.</li>
          <li>Use the Report button when content concerns you. Our team will review reports.</li>
        </ul>
      </Card>

      <Card as="section" className="space-y-4">
        <h2 className="text-xl font-semibold text-deep-plum">What the labels mean</h2>
        <dl className="space-y-4 text-sm leading-6 text-gray-800">
          <div><dt className="font-semibold text-deep-plum">Personal experience</dt><dd>A member is sharing what they experienced. It is not medical guidance for everyone.</dd></div>
          <div><dt className="font-semibold text-deep-plum">Community knowledge, not medically verified</dt><dd>Information shared by members that has not been checked by a medical reviewer.</dd></div>
          <div><dt className="font-semibold text-deep-plum">Evidence-backed</dt><dd>The post includes sources. Check the linked sources and discuss personal care with a professional.</dd></div>
          <div><dt className="font-semibold text-deep-plum">Verified professional</dt><dd>The member’s professional status has been reviewed by Her Space. This does not make every post a diagnosis or replace care.</dd></div>
        </dl>
      </Card>

      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium leading-6 text-rose-950">
        In an emergency, contact local emergency services or go to the nearest health facility.
      </p>
      <p className="text-sm text-gray-600">Questions or concerns? Contact us at [your contact email].</p>
    </PageShell>
  );
}