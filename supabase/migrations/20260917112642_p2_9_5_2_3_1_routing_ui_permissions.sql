-- P2.9.5.2.3.1 - Routing UI permissions hotfix
-- RLS policies already existed; authenticated also needs table-level SELECT grants.

begin;

grant select on table
  public.connected_bridges,
  public.connected_bridge_devices,
  public.connected_device_car_assignments,
  public.connected_vehicle_aliases,
  public.connected_routing_observations
to authenticated;

commit;
