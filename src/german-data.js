/* global window */
/**
 * B2 German drill content: der/die/das, fixed-case prepositions,
 * two-way (Wechsel) prepositions, and verbs with fixed prepositions.
 * Plain data — no build step, loaded as a global before app.js.
 */
window.GermanDrills = {
  // Gender: noun without article — answer is 'der' | 'die' | 'das'.
  gender: [
    { noun: 'Entscheidung', answer: 'die', hint: 'die Entscheidung – decision' },
    { noun: 'Eindruck', answer: 'der', hint: 'der Eindruck – impression' },
    { noun: 'Ergebnis', answer: 'das', hint: 'das Ergebnis – result' },
    { noun: 'Erfahrung', answer: 'die', hint: 'die Erfahrung – experience' },
    { noun: 'Vorschlag', answer: 'der', hint: 'der Vorschlag – suggestion' },
    { noun: 'Verständnis', answer: 'das', hint: 'das Verständnis – understanding' },
    { noun: 'Verantwortung', answer: 'die', hint: 'die Verantwortung – responsibility' },
    { noun: 'Zusammenhang', answer: 'der', hint: 'der Zusammenhang – connection, context' },
    { noun: 'Verhältnis', answer: 'das', hint: 'das Verhältnis – relationship, ratio' },
    { noun: 'Möglichkeit', answer: 'die', hint: 'die Möglichkeit – possibility' },
    { noun: 'Anspruch', answer: 'der', hint: 'der Anspruch – claim, demand' },
    { noun: 'Bewusstsein', answer: 'das', hint: 'das Bewusstsein – awareness, consciousness' },
    { noun: 'Voraussetzung', answer: 'die', hint: 'die Voraussetzung – prerequisite' },
    { noun: 'Nachweis', answer: 'der', hint: 'der Nachweis – proof' },
    { noun: 'Ereignis', answer: 'das', hint: 'das Ereignis – event' },
    { noun: 'Beziehung', answer: 'die', hint: 'die Beziehung – relationship' },
    { noun: 'Fortschritt', answer: 'der', hint: 'der Fortschritt – progress' },
    { noun: 'Vertrauen', answer: 'das', hint: 'das Vertrauen – trust' },
    { noun: 'Gewohnheit', answer: 'die', hint: 'die Gewohnheit – habit' },
    { noun: 'Widerspruch', answer: 'der', hint: 'der Widerspruch – contradiction' },
    { noun: 'Missverständnis', answer: 'das', hint: 'das Missverständnis – misunderstanding' },
    { noun: 'Unterschied', answer: 'der', hint: 'der Unterschied – difference' },
    { noun: 'Vorurteil', answer: 'das', hint: 'das Vorurteil – prejudice' },
    { noun: 'Herausforderung', answer: 'die', hint: 'die Herausforderung – challenge' }
  ],

  // Fixed-case prepositions — the case never changes with context.
  caseFixed: [
    { prep: 'durch', answer: 'Akkusativ', hint: 'durch, für, gegen, ohne, um + Akkusativ' },
    { prep: 'für', answer: 'Akkusativ', hint: 'durch, für, gegen, ohne, um + Akkusativ' },
    { prep: 'gegen', answer: 'Akkusativ', hint: 'durch, für, gegen, ohne, um + Akkusativ' },
    { prep: 'ohne', answer: 'Akkusativ', hint: 'durch, für, gegen, ohne, um + Akkusativ' },
    { prep: 'um', answer: 'Akkusativ', hint: 'durch, für, gegen, ohne, um + Akkusativ' },
    { prep: 'aus', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'bei', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'mit', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'nach', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'seit', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'von', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'zu', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'außer', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'gegenüber', answer: 'Dativ', hint: 'aus, bei, mit, nach, seit, von, zu, außer, gegenüber + Dativ' },
    { prep: 'wegen', answer: 'Genitiv', hint: 'wegen, trotz, während, statt, aufgrund, innerhalb + Genitiv' },
    { prep: 'trotz', answer: 'Genitiv', hint: 'wegen, trotz, während, statt, aufgrund, innerhalb + Genitiv' },
    { prep: 'während', answer: 'Genitiv', hint: 'wegen, trotz, während, statt, aufgrund, innerhalb + Genitiv' },
    { prep: 'statt', answer: 'Genitiv', hint: 'wegen, trotz, während, statt, aufgrund, innerhalb + Genitiv' },
    { prep: 'aufgrund', answer: 'Genitiv', hint: 'wegen, trotz, während, statt, aufgrund, innerhalb + Genitiv' },
    { prep: 'innerhalb', answer: 'Genitiv', hint: 'wegen, trotz, während, statt, aufgrund, innerhalb + Genitiv' }
  ],

  // Wechselpräpositionen — Akkusativ for motion/direction (Wohin?),
  // Dativ for static location (Wo?). Sentence already shows the case
  // via the article; the drill asks you to name which case it is.
  wechsel: [
    { sentence: 'Ich stelle die Vase auf den Tisch.', answer: 'Akkusativ', hint: 'Wohin? → Akkusativ (Bewegung, Richtung)' },
    { sentence: 'Die Vase steht auf dem Tisch.', answer: 'Dativ', hint: 'Wo? → Dativ (Position, Ruhe)' },
    { sentence: 'Er hängt das Bild an die Wand.', answer: 'Akkusativ', hint: 'Wohin? → Akkusativ' },
    { sentence: 'Das Bild hängt an der Wand.', answer: 'Dativ', hint: 'Wo? → Dativ' },
    { sentence: 'Wir gehen ins Kino.', answer: 'Akkusativ', hint: 'in + das → ins (Akkusativ, Wohin?)' },
    { sentence: 'Wir sind im Kino.', answer: 'Dativ', hint: 'in + dem → im (Dativ, Wo?)' },
    { sentence: 'Die Katze springt auf das Sofa.', answer: 'Akkusativ', hint: 'Wohin? → Akkusativ' },
    { sentence: 'Die Katze liegt auf dem Sofa.', answer: 'Dativ', hint: 'Wo? → Dativ' },
    { sentence: 'Er legt das Buch unter den Stuhl.', answer: 'Akkusativ', hint: 'Wohin? → Akkusativ' },
    { sentence: 'Das Buch liegt unter dem Stuhl.', answer: 'Dativ', hint: 'Wo? → Dativ' },
    { sentence: 'Sie setzt sich neben ihren Freund.', answer: 'Akkusativ', hint: 'Wohin (setzt sich)? → Akkusativ' },
    { sentence: 'Sie sitzt neben ihrem Freund.', answer: 'Dativ', hint: 'Wo (sitzt)? → Dativ' },
    { sentence: 'Der Vogel fliegt über den Fluss.', answer: 'Akkusativ', hint: 'Bewegung über etwas hinweg → Akkusativ' },
    { sentence: 'Die Lampe hängt über dem Tisch.', answer: 'Dativ', hint: 'Position → Dativ' },
    { sentence: 'Das Kind läuft hinter das Haus.', answer: 'Akkusativ', hint: 'Wohin? → Akkusativ' },
    { sentence: 'Das Auto steht hinter dem Haus.', answer: 'Dativ', hint: 'Wo? → Dativ' },
    { sentence: 'Er stellt sich zwischen die beiden Freunde.', answer: 'Akkusativ', hint: 'Wohin (stellt sich)? → Akkusativ' },
    { sentence: 'Das Regal steht zwischen den beiden Fenstern.', answer: 'Dativ', hint: 'Wo? → Dativ' }
  ],

  // Verbs with a fixed preposition that has to be memorized with the verb.
  // Options include plausible distractor prepositions.
  verbPrep: [
    { sentence: 'Ich freue mich schon ___ die Ferien.', options: ['auf', 'über', 'an'], answer: 'auf', hint: 'sich freuen auf +Akk – to look forward to' },
    { sentence: 'Sie freut sich sehr ___ das Geschenk, das sie bekommen hat.', options: ['auf', 'über', 'für'], answer: 'über', hint: 'sich freuen über +Akk – to be happy about (something that happened)' },
    { sentence: 'Wir warten schon eine Stunde ___ den Bus.', options: ['auf', 'für', 'nach'], answer: 'auf', hint: 'warten auf +Akk – to wait for' },
    { sentence: 'Denkst du manchmal ___ deine Schulzeit?', options: ['an', 'über', 'von'], answer: 'an', hint: 'denken an +Akk – to think of' },
    { sentence: 'Er interessiert sich sehr ___ Musik.', options: ['für', 'an', 'über'], answer: 'für', hint: 'sich interessieren für +Akk – to be interested in' },
    { sentence: 'Ich erinnere mich gut ___ diesen Tag.', options: ['an', 'bei', 'von'], answer: 'an', hint: 'sich erinnern an +Akk – to remember' },
    { sentence: 'Sie nimmt ___ dem Kurs teil.', options: ['an', 'bei', 'mit'], answer: 'an', hint: 'teilnehmen an +Dat – to participate in' },
    { sentence: 'Das Team besteht ___ zehn Personen.', options: ['aus', 'von', 'mit'], answer: 'aus', hint: 'bestehen aus +Dat – to consist of' },
    { sentence: 'Ich bedanke mich ___ dir für die Hilfe.', options: ['bei', 'für', 'mit'], answer: 'bei', hint: 'sich bedanken bei +Dat (für +Akk) – to thank someone (for)' },
    { sentence: 'Er beschäftigt sich viel ___ Geschichte.', options: ['mit', 'für', 'an'], answer: 'mit', hint: 'sich beschäftigen mit +Dat – to occupy oneself with' },
    { sentence: 'Sie träumt ___ einer Weltreise.', options: ['von', 'über', 'an'], answer: 'von', hint: 'träumen von +Dat – to dream of' },
    { sentence: 'Das gehört ___ den wichtigsten Themen.', options: ['zu', 'an', 'in'], answer: 'zu', hint: 'gehören zu +Dat – to belong to, be one of' },
    { sentence: 'Der Erfolg hängt ___ vielen Faktoren ab.', options: ['von', 'an', 'aus'], answer: 'von', hint: 'abhängen von +Dat – to depend on' },
    { sentence: 'Er bewirbt sich ___ die Stelle.', options: ['um', 'für', 'auf'], answer: 'um', hint: 'sich bewerben um +Akk – to apply for' },
    { sentence: 'Bitte achte mehr ___ deine Gesundheit.', options: ['auf', 'für', 'an'], answer: 'auf', hint: 'achten auf +Akk – to pay attention to' },
    { sentence: 'Sie glaubt fest ___ ihren Erfolg.', options: ['an', 'auf', 'von'], answer: 'an', hint: 'glauben an +Akk – to believe in' },
    { sentence: 'Ich gratuliere dir herzlich ___ deinem Erfolg.', options: ['zu', 'für', 'an'], answer: 'zu', hint: 'gratulieren zu +Dat – to congratulate on' },
    { sentence: 'Du kannst dich ___ mich verlassen.', options: ['auf', 'an', 'für'], answer: 'auf', hint: 'sich verlassen auf +Akk – to rely on' },
    { sentence: 'Ich zweifle nicht ___ deinen Fähigkeiten.', options: ['an', 'von', 'über'], answer: 'an', hint: 'zweifeln an +Dat – to doubt' },
    { sentence: 'Wir verzichten heute ___ Fleisch.', options: ['auf', 'von', 'für'], answer: 'auf', hint: 'verzichten auf +Akk – to do without' },
    { sentence: 'Viele Menschen leiden ___ dem Lärm in der Stadt.', options: ['unter', 'an', 'von'], answer: 'unter', hint: 'leiden unter +Dat – to suffer from (a situation)' },
    { sentence: 'Sie engagiert sich sehr ___ den Umweltschutz.', options: ['für', 'an', 'um'], answer: 'für', hint: 'sich engagieren für +Akk – to be committed to' }
  ]
};
