'use client';

import { useId } from 'react';
import type { Resume } from '@/types/resume';
import { normalizeLanguageDescriptionsForCompactTemplates } from '@/lib/language-description';
import { buildThemeCss, mergeThemeConfig } from '@/lib/resume-theme/build-theme-css';
import { ClassicTemplate } from './templates/classic';
import { ModernTemplate } from './templates/modern';
import { MinimalTemplate } from './templates/minimal';
import { ProfessionalTemplate } from './templates/professional';
import { TwoColumnTemplate } from './templates/two-column';
import { CreativeTemplate } from './templates/creative';
import { AtsTemplate } from './templates/ats';
import { AcademicTemplate } from './templates/academic';
import { ElegantTemplate } from './templates/elegant';
import { ExecutiveTemplate } from './templates/executive';
import { DeveloperTemplate } from './templates/developer';
import { DesignerTemplate } from './templates/designer';
import { StartupTemplate } from './templates/startup';
import { FormalTemplate } from './templates/formal';
import { InfographicTemplate } from './templates/infographic';
import { CompactTemplate } from './templates/compact';
import { EuroTemplate } from './templates/euro';
import { CleanTemplate } from './templates/clean';
import { BoldTemplate } from './templates/bold';
import { TimelineTemplate } from './templates/timeline';
// Batch 1: Industry/Professional
import { NordicTemplate } from './templates/nordic';
import { CorporateTemplate } from './templates/corporate';
import { ConsultantTemplate } from './templates/consultant';
import { FinanceTemplate } from './templates/finance';
import { MedicalTemplate } from './templates/medical';
// Batch 2: Modern/Tech
import { GradientTemplate } from './templates/gradient';
import { MetroTemplate } from './templates/metro';
import { MaterialTemplate } from './templates/material';
import { CoderTemplate } from './templates/coder';
import { BlocksTemplate } from './templates/blocks';
// Batch 3: Creative/Artistic
import { MagazineTemplate } from './templates/magazine';
import { ArtisticTemplate } from './templates/artistic';
import { RetroTemplate } from './templates/retro';
import { NeonTemplate } from './templates/neon';
import { WatercolorTemplate } from './templates/watercolor';
// Batch 4: Style/Culture
import { SwissTemplate } from './templates/swiss';
import { JapaneseTemplate } from './templates/japanese';
import { BerlinTemplate } from './templates/berlin';
import { LuxeTemplate } from './templates/luxe';
import { RoseTemplate } from './templates/rose';
// Batch 5: Specialized
import { ArchitectTemplate } from './templates/architect';
import { LegalTemplate } from './templates/legal';
import { TeacherTemplate } from './templates/teacher';
import { ScientistTemplate } from './templates/scientist';
import { EngineerTemplate } from './templates/engineer';
// Batch 6: Layout Variants
import { SidebarTemplate } from './templates/sidebar';
import { CardTemplate } from './templates/card';
import { ZigzagTemplate } from './templates/zigzag';
import { RibbonTemplate } from './templates/ribbon';
import { MosaicTemplate } from './templates/mosaic';

interface ResumePreviewProps {
  resume: Resume;
}

const templateMap: Record<string, React.ComponentType<{ resume: Resume }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  professional: ProfessionalTemplate,
  'two-column': TwoColumnTemplate,
  creative: CreativeTemplate,
  ats: AtsTemplate,
  academic: AcademicTemplate,
  elegant: ElegantTemplate,
  executive: ExecutiveTemplate,
  developer: DeveloperTemplate,
  designer: DesignerTemplate,
  startup: StartupTemplate,
  formal: FormalTemplate,
  infographic: InfographicTemplate,
  compact: CompactTemplate,
  euro: EuroTemplate,
  clean: CleanTemplate,
  bold: BoldTemplate,
  timeline: TimelineTemplate,
  // Batch 1
  nordic: NordicTemplate,
  corporate: CorporateTemplate,
  consultant: ConsultantTemplate,
  finance: FinanceTemplate,
  medical: MedicalTemplate,
  // Batch 2
  gradient: GradientTemplate,
  metro: MetroTemplate,
  material: MaterialTemplate,
  coder: CoderTemplate,
  blocks: BlocksTemplate,
  // Batch 3
  magazine: MagazineTemplate,
  artistic: ArtisticTemplate,
  retro: RetroTemplate,
  neon: NeonTemplate,
  watercolor: WatercolorTemplate,
  // Batch 4
  swiss: SwissTemplate,
  japanese: JapaneseTemplate,
  berlin: BerlinTemplate,
  luxe: LuxeTemplate,
  rose: RoseTemplate,
  // Batch 5
  architect: ArchitectTemplate,
  legal: LegalTemplate,
  teacher: TeacherTemplate,
  scientist: ScientistTemplate,
  engineer: EngineerTemplate,
  // Batch 6
  sidebar: SidebarTemplate,
  card: CardTemplate,
  zigzag: ZigzagTemplate,
  ribbon: RibbonTemplate,
  mosaic: MosaicTemplate,
};

export function ResumePreview({ resume }: ResumePreviewProps) {
  const Template = templateMap[resume.template] || ClassicTemplate;
  const scopeId = useId();
  const theme = mergeThemeConfig(resume.themeConfig);

  // Defensive: ensure resume.sections is always an array (AI may return invalid/empty data)
  const safeResume = normalizeLanguageDescriptionsForCompactTemplates(
    resume.sections ? resume : { ...resume, sections: [] }
  );

  return (
    <>
      <div data-theme-scope={scopeId}>
        <style
          dangerouslySetInnerHTML={{
            __html: buildThemeCss({
              selector: `[data-theme-scope="${scopeId}"]`,
              theme,
              template: safeResume.template,
              includeNeedsPadding: true,
            }),
          }}
        />
        <Template resume={safeResume} />
      </div>
    </>
  );
}
