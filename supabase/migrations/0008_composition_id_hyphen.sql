-- Remotion composition ids cannot contain underscores (a-z A-Z 0-9 CJK - only).
update studio_projects
set composition_id = 'talking-head-60'
where composition_id = 'talking_head_60';
