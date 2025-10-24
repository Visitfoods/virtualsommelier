export interface Follower {
  id: string;
  guideId: string;
  guideSlug: string;
  name: string;
  email: string;
  timestamp: string;
  createdAt: Date;
  // Campos opcionais do formulário
  phone?: string;
  company?: string;
  message?: string;
  // Metadados
  source: 'follow_form' | 'manual';
  userAgent?: string;
  ipAddress?: string;
}

export interface FollowerFormConfig {
  title: string;
  description: string;
  fields: {
    name: { required: boolean; placeholder: string };
    email: { required: boolean; placeholder: string };
    phone: { required: boolean; placeholder: string; enabled: boolean };
    company: { required: boolean; placeholder: string; enabled: boolean };
    message: { required: boolean; placeholder: string; enabled: boolean };
  };
  submitButtonText: string;
  successMessage: string;
}

export interface FollowerFilters {
  guideId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
