// Route-owned bilingual specimen, not a product feature or React typography API.
export function TypographyPreview() {
  return <section aria-label="Typography and spacing" data-typography-fixture className="ds-sections tw:mt-8">
    <header className="ds-stack">
      <h2 className="ds-text-page-title" lang="en">Workspace overview</h2>
      <h2 className="ds-text-page-title" lang="ar" data-arabic-sample>نَظْرَةٌ عَامَّةٌ عَلَى مَسَاحَةِ العَمَلِ</h2>
      <p className="ds-text-body-small">Typography specimens only / <span lang="ar">أمثلة الخطوط والمسافات فقط</span></p>
    </header>
    <section className="ds-stack">
      <h3 className="ds-text-section-title">Section title / <span lang="ar" data-arabic-sample>عُنْوَانُ القِسْمِ</span></h3>
      <div className="tw:grid tw:gap-6 tw:md:grid-cols-2">
        <article className="ds-sample ds-card-space ds-stack" data-density="standard">
          <h4 className="ds-text-card-title">Standard card / <span lang="ar">بطاقة قياسية</span></h4>
          <p className="ds-text-body ds-text-long" lang="en">A clear hierarchy helps teams review long names, amounts, and instructions without rushing. Keep the text readable and the spacing consistent across cards and forms.</p>
          <p className="ds-text-body ds-text-long" lang="ar" data-arabic-sample>تُسَاعِدُ المَسَافَاتُ المُنْتَظِمَةُ وَوُضُوحُ الخَطِّ عَلَى قِرَاءَةِ التَّعْلِيمَاتِ وَالأَسْمَاءِ الطَّوِيلَةِ بِهُدُوءٍ. تَظَلُّ الحَرَكَاتُ وَالحُرُوفُ وَاضِحَةً فِي الفِقْرَاتِ وَحُقُولِ النَّمَاذِجِ.</p>
          <p className="ds-text-helper">Helper text / <span lang="ar" data-arabic-sample>نَصٌّ مُسَاعِدٌ لِتَوْضِيحِ المَعْلُومَاتِ</span></p>
          <p className="ds-text-caption">Caption / <span lang="ar" data-arabic-sample>مُلَاحَظَةٌ قَصِيرَةٌ</span></p>
        </article>
        <article className="ds-sample ds-card-space-compact ds-stack" data-density="compact">
          <h4 className="ds-text-card-title">Compact card / <span lang="ar">بطاقة موجزة</span></h4>
          <p className="ds-text-body-small">Compact changes spacing, preserving readable type.</p>
          <div className="ds-stack" aria-label="Metric specimens">
            <p className="ds-text-metric-lg"><bdi lang="en" dir="ltr">124</bdi></p>
            <p className="ds-text-metric-md"><bdi lang="en" dir="ltr">12.4%</bdi></p>
            <p className="ds-text-metric-md"><bdi lang="en" dir="ltr">IQD 250,000</bdi></p>
            <p className="ds-text-metric-md" lang="ar" data-arabic-sample><bdi>١٢٤</bdi></p>
            <code className="ds-text-code">request_id: specimen</code>
          </div>
        </article>
      </div>
    </section>
    <section className="ds-stack">
      <h3 className="ds-text-section-title">Form rhythm / <span lang="ar">إيقاع النماذج</span></h3>
      <div className="tw:grid tw:gap-6 tw:md:grid-cols-2">
        {(['standard','compact'] as const).map(density=><div key={density} className={`ds-sample ${density==='compact'?'ds-card-space-compact':'ds-card-space'} ds-form ${density==='compact'?'ds-form-compact':''}`} data-form-density={density}>
          <h4 className="ds-text-card-title">{density==='compact'?'Compact form':'Standard form'}</h4>
          <div className="ds-field">
            <label className="ds-text-label" htmlFor={`specimen-name-${density}`}>Name / <span lang="ar" data-arabic-sample>الاِسْمُ</span></label>
            <input id={`specimen-name-${density}`} className="ds-control" placeholder="Name / الاسم" aria-describedby={`specimen-help-${density}`} />
            <p id={`specimen-help-${density}`} className="ds-text-helper">Use a readable name / <span lang="ar">استخدم اسماً واضحاً</span></p>
          </div>
          <div className="ds-field">
            <label className="ds-text-label" htmlFor={`specimen-note-${density}`}>Note / <span lang="ar">ملاحظة</span></label>
            <input id={`specimen-note-${density}`} className={`ds-control ${density==='compact'?'ds-control-small':''}`} placeholder="Optional / اختياري" />
          </div>
          <p className="ds-text-caption">Spacing specimen; no data is submitted.</p>
        </div>)}
      </div>
    </section>
    <p className="ds-text-body tw:text-sm tw:font-medium tw:ps-4" data-tailwind-typography>Tailwind bridge / <span lang="ar">ربط المقاييس</span></p>
  </section>;
}
