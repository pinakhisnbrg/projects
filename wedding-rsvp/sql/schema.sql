-- Run in Supabase SQL editor. Never expose service-role key to the browser.
create extension if not exists pgcrypto;
create table if not exists public.invitations (
 id uuid primary key default gen_random_uuid(),
 invite_token text not null unique,
 household_name text not null,
 phone text,
 allowed_guests int not null check(allowed_guests between 1 and 30),
 notes text,
 created_at timestamptz default now()
);
create table if not exists public.rsvps (
 invitation_id uuid primary key references public.invitations(id) on delete cascade,
 status text not null check(status in ('yes','maybe','no')),
 adults int not null default 0 check(adults between 0 and 30),
 children int not null default 0 check(children between 0 and 30),
 guest_names jsonb not null default '[]'::jsonb,
 song text,
 updated_at timestamptz not null default now(),
 check((status='yes' and adults>=1) or (status<>'yes' and adults=0 and children=0))
);
create table if not exists public.guest_passes (
 id uuid primary key default gen_random_uuid(),
 invitation_id uuid not null references public.invitations(id) on delete cascade,
 slot int not null check(slot between 1 and 30),
 guest_name text not null,
 checkin_code text not null unique,
 checked_in_at timestamptz,
 active boolean not null default true,
 unique(invitation_id,slot)
);
create index if not exists guest_passes_code_idx on public.guest_passes(checkin_code);
create table if not exists public.site_settings (
 key text primary key,
 value jsonb not null,
 updated_at timestamptz not null default now()
);
-- Atomic household RSVP transaction; guests cannot exceed allocated capacity.
create or replace function public.submit_wedding_rsvp(
 p_token text,p_status text,p_adults int,p_children int,p_names jsonb,p_song text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare inv public.invitations%rowtype; i int; count_guests int; names jsonb;
begin
 select * into inv from public.invitations where invite_token=p_token for update;
 if not found then raise exception 'INVALID_INVITATION'; end if;
 if p_status not in ('yes','maybe','no') then raise exception 'INVALID_STATUS'; end if;
 if p_adults is null or p_children is null or p_adults<0 or p_children<0 then raise exception 'INVALID_COUNT'; end if;
 count_guests:=case when p_status='yes' then p_adults+p_children else 0 end;
 if count_guests>inv.allowed_guests or (p_status='yes' and p_adults<1) then raise exception 'GUEST_LIMIT'; end if;
 names:=case when jsonb_typeof(p_names)='array' then p_names else '[]'::jsonb end;
 if p_status='yes' and jsonb_array_length(names)<>count_guests then raise exception 'GUEST_NAMES_REQUIRED'; end if;
 insert into public.rsvps(invitation_id,status,adults,children,guest_names,song)
 values(inv.id,p_status,case when p_status='yes' then p_adults else 0 end,
 case when p_status='yes' then p_children else 0 end,names,left(coalesce(p_song,''),160))
 on conflict(invitation_id) do update set status=excluded.status,adults=excluded.adults,
 children=excluded.children,guest_names=excluded.guest_names,song=excluded.song,updated_at=now();
 update public.guest_passes set active=false where invitation_id=inv.id and slot>count_guests;
 for i in 1..count_guests loop
  insert into public.guest_passes(invitation_id,slot,guest_name,checkin_code,active)
  values(inv.id,i,left(trim(names->>(i-1)),100),encode(gen_random_bytes(24),'hex'),true)
  on conflict(invitation_id,slot) do update set active=true,guest_name=excluded.guest_name;
 end loop;
 return jsonb_build_object('confirmed',count_guests,'status',p_status);
end;$$;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.guest_passes enable row level security;
alter table public.site_settings enable row level security;
revoke all on public.invitations,public.rsvps,public.guest_passes,public.site_settings from anon,authenticated;
revoke execute on function public.submit_wedding_rsvp(text,text,int,int,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_wedding_rsvp(text,text,int,int,jsonb,text) to service_role;
-- Invitation seed example (replace household and seat allocation, and only send unique private links).
-- insert into public.invitations(invite_token,household_name,allowed_guests)
-- values(encode(gen_random_bytes(24),'hex'),'Sample Household',4);
