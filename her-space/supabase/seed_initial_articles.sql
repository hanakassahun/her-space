-- Add the first five Learn drafts without publishing them.
INSERT INTO public.articles (
  slug,
  title,
  summary,
  category,
  topics,
  normal,
  needs_attention,
  see_doctor,
  doctor_questions,
  sources,
  reviewed_by,
  published
)
VALUES
  (
    'normal-menstrual-cycle',
    'Your cycle: what''s normal?',
    'Cycles vary a lot from person to person. Here''s the range that''s usually considered normal.',
    'health',
    ARRAY['periods', 'hormones'],
    'Your cycle is counted from the first day of one period to the first day of the next. In adults it''s commonly between 21 and 35 days, and in the first few years after periods start it can be longer and less predictable. Periods usually last 2 to 7 days. Cramps, mild mood changes, and changes in discharge across the month are common. Your own pattern matters more than the "average" of 28 days.',
    '- Periods that suddenly stop for 3 months or more (and you''re not pregnant)' || E'\n' || '- Cycles that are regularly shorter than 21 days or longer than 35 days' || E'\n' || '- Bleeding that soaks through a pad or tampon every hour for several hours, or large clots' || E'\n' || '- Bleeding between periods or after sex' || E'\n' || '- Periods that last more than 7 days',
    'See a doctor if any of the above keeps happening, or if your cycle changes a lot and you don''t know why. Get urgent care if you feel dizzy or faint with very heavy bleeding.',
    ARRAY[
      'Is my cycle length normal for my age?',
      'Could my symptoms be linked to hormones, stress, or weight changes?',
      'Do I need any tests?'
    ],
    ARRAY[
      'https://www.nhs.uk/conditions/periods/',
      'https://www.nhs.uk/conditions/heavy-periods/'
    ],
    NULL,
    false
  ),
  (
    'vaginal-discharge',
    'Vaginal discharge: what''s normal and what isn''t',
    'Discharge changes through your cycle, and that''s usually healthy. Here''s how to tell when something is different.',
    'health',
    ARRAY['hormones', 'hygiene', 'sexual health'],
    'Discharge is how the vagina cleans itself. It can be clear, white, or slightly creamy, and it changes in thickness during the month. Around ovulation it''s often clear and stretchy, like raw egg white. It may dry slightly yellowish on underwear. A mild smell that isn''t strong or unpleasant is normal.',
    '- Green, yellow, or grey discharge' || E'\n' || '- A strong fishy smell' || E'\n' || '- Thick white discharge like cottage cheese with itching or soreness' || E'\n' || '- Pain or burning when you urinate or during sex' || E'\n' || '- Bleeding between periods, or discharge with lower belly pain',
    'See a doctor if you notice any of the above, especially if it comes after unprotected sex, you''re pregnant, or you have a fever or pelvic pain. Many causes are easily treated, but they need the right treatment, so avoid guessing with creams or tablets. Don''t douche or use strong soaps inside the vagina. The vagina cleans itself, and these can upset its natural balance.',
    ARRAY[
      'What is causing this, and how do you know?',
      'Do I need a test for infections?',
      'Does my partner need treatment too?',
      'How can I prevent it from coming back?'
    ],
    ARRAY['https://www.nhs.uk/conditions/vaginal-discharge/'],
    NULL,
    false
  ),
  (
    'pcos-basics',
    'PCOS: the basics',
    'PCOS is a common hormone condition. Having some of its signs doesn''t mean you have it, and only a doctor can diagnose it.',
    'health',
    ARRAY['PCOS', 'hormones', 'periods', 'fertility'],
    'Many people have one or two signs sometimes, like acne, an irregular period, or a bit of extra hair growth, without having PCOS. Hormones shift a lot in the teenage years and during stress, illness, or weight changes.',
    'Having several of these together over time:' || E'\n' || '- Irregular or missing periods' || E'\n' || '- Excess hair on the face or body, or thinning hair on the scalp' || E'\n' || '- Persistent acne or oily skin' || E'\n' || '- Weight gain that is hard to explain' || E'\n' || '- Difficulty getting pregnant',
    'Talk to a doctor if several of these signs are present for months. PCOS is usually diagnosed by a doctor using symptoms, blood tests, and sometimes an ultrasound. There is no cure, but it is manageable, and the right care can help with symptoms, cycles, and long-term health. Be careful with online claims about "curing" PCOS with a single food, drink, or supplement.',
    ARRAY[
      'Which tests do I need to find out if this is PCOS?',
      'Could something else be causing my symptoms?',
      'What treatment options exist for my main concern (periods, skin, hair, fertility)?',
      'Should I be checked for related conditions like diabetes?'
    ],
    ARRAY[
      'https://www.nhs.uk/conditions/polycystic-ovary-syndrome-pcos/',
      'https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome'
    ],
    NULL,
    false
  ),
  (
    'first-gynecologist-visit',
    'Your first gynecologist visit',
    'What to expect, what you''re allowed to ask, and why being nervous is completely normal.',
    'life_stages',
    ARRAY['sexual health', 'periods', 'contraception'],
    'Feeling nervous or embarrassed is very common, and doctors see this all the time. You don''t need to be perfectly groomed, and you can ask any question, even ones that feel awkward. Many first visits are mostly a conversation about your periods, health history, and concerns. An internal exam isn''t always needed at a first visit, so ask what is planned and why. You can ask for it to be explained step by step, and you can say "stop" at any point.',
    'Be ready to mention anything unusual, such as very painful or heavy periods, unusual discharge, pain during sex, lumps or pain in your breasts, or bleeding between periods. If a provider dismisses your concern without explaining, or makes you uncomfortable, you''re allowed to ask for a different provider.',
    'Go when you have a concern, not only when something is "serious." Common reasons: painful or irregular periods, discharge changes, contraception questions, or worries about sexual health.',
    ARRAY[
      'What will happen during this visit, and is an exam needed today?',
      'Is what I''m describing normal for my age?',
      'What are my options for contraception, if I''m interested?',
      'When should I come back, and what symptoms mean I should come sooner?'
    ],
    ARRAY['https://www.nhs.uk/conditions/cervical-screening/'],
    NULL,
    false
  ),
  (
    'cramps-vs-pain',
    'Period cramps vs. pain that needs attention',
    'Some cramping is common. Pain that disrupts your life isn''t something you have to just put up with.',
    'health',
    ARRAY['periods', 'hormones'],
    'Mild to moderate cramps in the lower belly just before or during the first days of your period are very common. They often ease with a heat pack, rest, gentle movement, and over-the-counter pain relief used exactly as the label says.',
    '- Pain that makes you miss school, work, or normal activities' || E'\n' || '- Cramps that keep getting worse over the months or years' || E'\n' || '- Pain during sex, or pelvic pain outside your period' || E'\n' || '- Heavy bleeding together with strong pain' || E'\n' || '- Pain that doesn''t improve with usual pain relief' || E'\n\n' || 'Severe period pain can have causes that a doctor can investigate, such as endometriosis or fibroids, but only a doctor can tell what''s behind it.',
    'See a doctor if the pain is affecting your daily life or getting worse. Get urgent care right away for sudden severe pelvic pain, pain with fever, fainting, or one-sided pain with bleeding when you might be pregnant.',
    ARRAY[
      'What could be causing my pain?',
      'Do I need an ultrasound or other tests?',
      'Which pain relief is safe for me, and at what dose?',
      'Are there treatments that reduce period pain?'
    ],
    ARRAY['https://www.nhs.uk/conditions/period-pain/'],
    NULL,
    false
  )
ON CONFLICT (slug) DO NOTHING;
