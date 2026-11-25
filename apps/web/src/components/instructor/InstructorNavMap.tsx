import type { DashboardNavItem } from '@/components/layout/DashboardShell';
import React from 'react';
import { Award, BookOpen, FileVideo, MessageSquare, ShieldCheck } from 'lucide-react';

export type InstructorSectionKey = 'courses' | 'videos' | 'collab' | 'recommendations';

export function buildInstructorAccordionNavItems({
  activeSection,
  onSelectSection,
  coursesCount,
  unreadCollabCount,
  recommendationsCount,
}: {
  activeSection: InstructorSectionKey;
  onSelectSection?: (section: 'courses' | 'collab' | 'recommendations') => void;
  coursesCount?: number;
  unreadCollabCount?: number;
  recommendationsCount?: number;
}): DashboardNavItem[] {
  return [
    {
      id: 'courses',
      label: 'كورساتي ومعالج الإنشاء',
      group: 'التدريس والمحتوى',
      icon: <BookOpen className="h-4 w-4" />,
      href: onSelectSection ? undefined : '/instructor',
      onClick: onSelectSection ? () => onSelectSection('courses') : undefined,
      active: activeSection === 'courses',
      badge: coursesCount ? coursesCount : undefined,
    },
    {
      id: 'videos',
      label: 'مكتبة الفيديوهات والترجمات',
      group: 'التدريس والمحتوى',
      icon: <FileVideo className="h-4 w-4" />,
      href: '/instructor/videos',
      active: activeSection === 'videos',
    },
    {
      id: 'collab',
      label: 'المهام والتواصل مع الإدارة',
      group: 'التواصل والاعتمادات',
      icon: <MessageSquare className="h-4 w-4" />,
      href: onSelectSection ? undefined : '/instructor?section=collab',
      onClick: onSelectSection ? () => onSelectSection('collab') : undefined,
      active: activeSection === 'collab',
      badge: unreadCollabCount && unreadCollabCount > 0 ? unreadCollabCount : undefined,
    },
    {
      id: 'recommendations',
      label: 'طلبات خطابات التوصية',
      group: 'التواصل والاعتمادات',
      icon: <Award className="h-4 w-4" />,
      href: onSelectSection ? undefined : '/instructor?section=recommendations',
      onClick: onSelectSection ? () => onSelectSection('recommendations') : undefined,
      active: activeSection === 'recommendations',
      badge: recommendationsCount && recommendationsCount > 0 ? recommendationsCount : undefined,
    },
    {
      id: 'settings',
      label: 'الإعدادات والأمان',
      group: 'الحساب والملف الشخصي',
      icon: <ShieldCheck className="h-4 w-4" />,
      href: '/student/settings',
    },
  ];
}
