// Server component: the FAQ is in the initial HTML, next to its FAQPage structured data.
import { FAQ, FAQ_JSON_LD } from "@/lib/faq";

export default function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-7xl px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <div className="grid gap-6 border-t border-line pt-10 md:grid-cols-[1fr_2fr]">
        <h2 id="faq-heading" className="text-xl font-semibold text-fg">
          Bitcoin mining calculator FAQ
        </h2>
        <dl className="grid gap-5 text-sm leading-relaxed text-fg-2 sm:grid-cols-2">
          {FAQ.map(({ question, answer }) => (
            <div key={question}>
              <dt className="mb-1 font-semibold text-fg">{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
