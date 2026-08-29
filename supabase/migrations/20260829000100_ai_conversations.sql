begin;

alter table public.ai_provider_settings
  alter column chat_model set default 'gemini-3.7-flash';

update public.ai_provider_settings
set chat_model = 'gemini-3.7-flash', updated_at = now()
where chat_model in ('gemini-2.5-flash-lite', 'gemini-2.5-flash');

create table public.ai_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_id_owner_unique unique (id, owner_id)
);

create table public.ai_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 30000),
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now(),
  constraint ai_messages_id_owner_unique unique (id, owner_id),
  constraint ai_messages_conversation_owner_fk
    foreign key (conversation_id, owner_id)
    references public.ai_conversations(id, owner_id) on delete cascade
);

create table public.ai_message_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null,
  item_id uuid not null,
  section_id uuid,
  rank integer not null check (rank between 1 and 12),
  snippet text not null check (char_length(snippet) between 1 and 1200),
  created_at timestamptz not null default now(),
  constraint ai_message_sources_message_owner_fk
    foreign key (message_id, owner_id)
    references public.ai_messages(id, owner_id) on delete cascade,
  constraint ai_message_sources_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id) on delete cascade,
  constraint ai_message_sources_section_fk
    foreign key (section_id)
    references public.document_sections(id) on delete set null,
  constraint ai_message_sources_message_rank_unique unique (message_id, rank)
);

create index ai_conversations_owner_updated_idx
  on public.ai_conversations(owner_id, updated_at desc);
create index ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at);
create index ai_message_sources_message_rank_idx
  on public.ai_message_sources(message_id, rank);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_message_sources enable row level security;

revoke all on table public.ai_conversations, public.ai_messages, public.ai_message_sources
from anon, authenticated;
grant select, insert, update, delete on table public.ai_conversations to authenticated;
grant select on table public.ai_messages, public.ai_message_sources to authenticated;

create policy ai_conversations_owner_all on public.ai_conversations
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy ai_messages_owner_select on public.ai_messages
for select to authenticated using ((select auth.uid()) = owner_id);

create policy ai_message_sources_owner_select on public.ai_message_sources
for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.save_ai_exchange(
  p_conversation_id uuid,
  p_question text,
  p_answer text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_sources jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  conversation_id uuid := p_conversation_id;
  user_message_id uuid := extensions.gen_random_uuid();
  assistant_message_id uuid := extensions.gen_random_uuid();
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if char_length(trim(coalesce(p_question, ''))) not between 1 and 4000 then
    raise exception 'AI_QUESTION_LENGTH_INVALID';
  end if;
  if char_length(trim(coalesce(p_answer, ''))) not between 1 and 30000 then
    raise exception 'AI_ANSWER_LENGTH_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_sources, '[]'::jsonb)) <> 'array' then
    raise exception 'AI_SOURCES_INVALID';
  end if;

  if conversation_id is null then
    insert into public.ai_conversations (owner_id, title)
    values (current_owner, left(trim(p_question), 120))
    returning id into conversation_id;
  elsif not exists (
    select 1 from public.ai_conversations
    where id = conversation_id and owner_id = current_owner
  ) then
    raise exception 'AI_CONVERSATION_NOT_FOUND';
  end if;

  insert into public.ai_messages (
    id, owner_id, conversation_id, role, content
  ) values (
    user_message_id, current_owner, conversation_id, 'user', trim(p_question)
  );

  insert into public.ai_messages (
    id, owner_id, conversation_id, role, content, model, input_tokens, output_tokens
  ) values (
    assistant_message_id, current_owner, conversation_id, 'assistant', trim(p_answer),
    nullif(trim(p_model), ''), greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0)
  );

  insert into public.ai_message_sources (
    owner_id, message_id, item_id, section_id, rank, snippet
  )
  select
    current_owner,
    assistant_message_id,
    source.item_id,
    source.section_id,
    source.rank,
    left(trim(source.snippet), 1200)
  from jsonb_to_recordset(coalesce(p_sources, '[]'::jsonb)) as source(
    item_id uuid,
    section_id uuid,
    rank integer,
    snippet text
  )
  join public.knowledge_items as item
    on item.id = source.item_id and item.owner_id = current_owner and item.deleted_at is null
  left join public.document_sections as section
    on section.id = source.section_id and section.owner_id = current_owner
  where source.rank between 1 and 12
    and trim(coalesce(source.snippet, '')) <> ''
    and (source.section_id is null or section.id is not null)
  order by source.rank
  limit 12;

  update public.ai_conversations
  set updated_at = now()
  where id = conversation_id and owner_id = current_owner;

  return jsonb_build_object(
    'conversation_id', conversation_id,
    'user_message_id', user_message_id,
    'assistant_message_id', assistant_message_id
  );
end;
$function$;

revoke all on function public.save_ai_exchange(uuid, text, text, text, integer, integer, jsonb)
from public, anon;
grant execute on function public.save_ai_exchange(uuid, text, text, text, integer, integer, jsonb)
to authenticated;

commit;
