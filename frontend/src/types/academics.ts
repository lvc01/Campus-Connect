export interface CourseData {
  id: string;
  code: string;
  name: string;
  faculty: string;
  description: string | null;
  year: number | null;
  semester: number | null;
  created_at: string;
  member_count: number;
  resource_count: number;
  is_member: boolean;
  member_role: string | null;
}

export interface ResourceData {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  file_url: string;
  file_size: number | null;
  download_count: number;
  created_at: string;
  course_id: string;
  uploaded_by: string;
  uploader: { id: string; email: string; role: string; profile: { display_name: string; avatar_url: string | null } | null };
}

export interface StudyGroupData {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  max_members: number;
  created_by: string;
  created_at: string;
  member_count: number;
  is_member: boolean;
}
