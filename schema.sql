-- ĐIỀU HÀNH 360 — chạy toàn bộ tệp trong Supabase SQL Editor (dự án MỚI).
-- LƯU Ý: Sau khi đăng ký tài khoản quản trị đầu tiên, cập nhật vai trò bằng lệnh ở cuối.
-- Không sử dụng secret/service_role key trên website.

create schema if not exists private;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  department_id uuid references public.departments(id) on delete set null,
  role text not null default 'staff' check (role in ('staff','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 180),
  type text not null check (type in ('task','survey')),
  description text not null default '',
  due_date date not null,
  status text not null default 'active' check (status in ('active','closed')),
  questions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  unique(campaign_id,department_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  summary text not null default '',
  answers jsonb not null default '{}'::jsonb,
  evidence_url text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists assignments_department_idx on public.assignments(department_id);
create index if not exists assignments_campaign_idx on public.assignments(campaign_id);
create index if not exists profiles_department_idx on public.profiles(department_id);
create index if not exists campaigns_due_date_idx on public.campaigns(due_date);

-- Mọi tài khoản mới là cán bộ, chưa gán phòng; chỉ người quản trị được phân quyền.
create or replace function private.create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'staff')
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_profile_created on auth.users;
create trigger auth_user_profile_created
  after insert on auth.users for each row execute function private.create_user_profile();

-- Hàm dùng trong RLS. Không đặt role/department trong metadata do người dùng sửa được.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;

create or replace function private.my_department()
returns uuid language sql stable security definer set search_path = '' as $$
  select department_id from public.profiles where id=(select auth.uid());
$$;

create or replace function private.can_report(a_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.assignments a
    join public.campaigns c on c.id=a.campaign_id
    join public.profiles p on p.department_id=a.department_id
    where a.id=a_id and p.id=(select auth.uid()) and c.status='active'
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke execute on function private.create_user_profile() from public, anon, authenticated;
revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.my_department() from public, anon;
revoke execute on function private.can_report(uuid) from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.my_department() to authenticated;
grant execute on function private.can_report(uuid) to authenticated;

-- Quyền truy cập: mặc định chặn khách chưa đăng nhập.
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

revoke all on public.departments,public.profiles,public.campaigns,public.assignments,public.submissions from anon,authenticated;
grant select,insert,update on public.departments to authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update on public.campaigns to authenticated;
grant select,insert on public.assignments to authenticated;
grant select,insert,update on public.submissions to authenticated;

create policy "departments: signed-in read" on public.departments for select to authenticated using (true);
create policy "departments: admin insert" on public.departments for insert to authenticated with check ((select private.is_admin()));
create policy "departments: admin update" on public.departments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "profiles: own or admin read" on public.profiles for select to authenticated
  using (id=(select auth.uid()) or (select private.is_admin()));
create policy "profiles: admin update" on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "campaigns: assigned or admin read" on public.campaigns for select to authenticated
  using ((select private.is_admin()) or exists (
    select 1 from public.assignments a where a.campaign_id=campaigns.id and a.department_id=(select private.my_department())
  ));
create policy "campaigns: admin insert" on public.campaigns for insert to authenticated
  with check ((select private.is_admin()) and created_by=(select auth.uid()));
create policy "campaigns: admin update" on public.campaigns for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "assignments: own dept or admin read" on public.assignments for select to authenticated
  using ((select private.is_admin()) or department_id=(select private.my_department()));
create policy "assignments: admin insert" on public.assignments for insert to authenticated
  with check ((select private.is_admin()));

create policy "submissions: own dept or admin read" on public.submissions for select to authenticated
  using ((select private.is_admin()) or exists(
    select 1 from public.assignments a where a.id=submissions.assignment_id and a.department_id=(select private.my_department())
  ));
create policy "submissions: assigned staff insert" on public.submissions for insert to authenticated
  with check (user_id=(select auth.uid()) and (select private.can_report(assignment_id)));
create policy "submissions: assigned staff update" on public.submissions for update to authenticated
  using ((select private.can_report(assignment_id)))
  with check (user_id=(select auth.uid()) and (select private.can_report(assignment_id)));

-- TẠO QUẢN TRỊ VIÊN ĐẦU TIÊN (CHẠY SAU, KHÔNG CHẠY NGAY):
-- 1) Mở web, chọn Đăng ký, đăng ký bằng email của người quản lý.
-- 2) Xác nhận email (nếu Supabase yêu cầu).
-- 3) Trong SQL Editor, chạy câu SQL sau và thay địa chỉ email:
-- update public.profiles set role='admin' where email='email-quan-tri@donvi.vn';
-- 4) Đăng nhập lại; tài khoản này sẽ thấy màn hình tạo phòng ban và gán cán bộ.
-- Để bảo mật, sau khi tạo đủ tài khoản, cân nhắc tắt đăng ký tự do trong Supabase Auth.
