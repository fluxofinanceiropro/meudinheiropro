import postgres from "postgres";

const url = process.env.STAGING_DATABASE_URL ?? "";
const PROJECT = "jewoooybinxfcssyixff";
if (!url.includes(PROJECT) || url.includes("smkbyxxtfojestenolpo")) {
  throw new Error("Only the isolated staging Supabase project is permitted");
}
const sql = postgres(url, { max: 5, idle_timeout: 5, connect_timeout: 15 });
const WS = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222221";
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EDITOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VIEWER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const check = (truth: unknown, msg: string) => { if (!truth) throw new Error(msg); };
async function asUser<T>(uid: string, callback: (t: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async t => {
    await t.unsafe("set local role authenticated");
    await t`select set_config('request.jwt.claim.sub', ${uid}, true)`;
    return callback(t);
  });
}
async function balance() {
  const [row] = await sql`select balance from public.account_balances where account_id=${A}`;
  return Number(row?.balance);
}
async function execute() {
  const current = await balance();
  check(current === 120, "Unexpected staging fixture balance; refusing mutation");
  const [member] = await asUser(VIEWER, t => t`select public.is_workspace_member(${WS}::uuid) as read_ok, public.can_edit_workspace(${WS}::uuid) as write_ok`);
  check(member.read_ok === true && member.write_ok === false, "Viewer access predicates incorrect");
  let rejected = false;
  try {
    await asUser(VIEWER, t => t`select public.adjust_workspace_balances(${WS}::uuid, ${JSON.stringify([{id:A,expected_cents:12000,desired_cents:12500}])}::jsonb)`);
  } catch (e) {
    rejected = String(e).includes("Sem permissão");
  }
  check(rejected, "Viewer was not denied by RPC");
  const [editor] = await asUser(EDITOR, t => t`select public.can_edit_workspace(${WS}::uuid) as allowed`);
  check(editor.allowed === true, "Editor should have permission");
  console.log("PASS: viewer blocked, editor authorized (simulated JWT claims)");

  // Both sessions claim the same initial balance: only one should commit.
  const attempts = await Promise.allSettled([
    asUser(EDITOR, t => t`select public.adjust_workspace_balances(${WS}::uuid, ${JSON.stringify([{id:A,expected_cents:12000,desired_cents:12300}])}::jsonb)`),
    asUser(EDITOR, t => t`select public.adjust_workspace_balances(${WS}::uuid, ${JSON.stringify([{id:A,expected_cents:12000,desired_cents:12400}])}::jsonb)`)
  ]);
  const successes = attempts.filter(x => x.status === "fulfilled").length;
  const failures = attempts.filter(x => x.status === "rejected");
  check(successes === 1 && failures.length === 1, "Concurrency did not yield exactly one winner");
  check(String((failures[0] as PromiseRejectedResult).reason).includes("O saldo mudou"), "Rejected update did not detect stale balance");
  check([123,124].includes(await balance()), "Winner balance mismatch");
  console.log("PASS: concurrent updates serialized, stale balance rejected");

  // Reserve: create fictitious income and linked allocation inside a rolled-back transaction.
  class ExpectedRollback extends Error {}
  let checked = false;
  try {
    await sql.begin(async t => {
      const txid = crypto.randomUUID(), goalid = crypto.randomUUID(), entryid = crypto.randomUUID();
      await t`insert into public.goals(id,workspace_id,name,kind,target_amount) values (${goalid},${WS},'Reserva teste','reserve',0)`;
      await t`insert into public.transactions(id,workspace_id,kind,description,amount,occurred_on,status,account_id,created_by) values (${txid},${WS},'income','Receita fictícia',100,'2026-10-24','paid',${A},${OWNER})`;
      await t`insert into public.goal_entries(id,workspace_id,goal_id,amount,created_by,source_transaction_id) values (${entryid},${WS},${goalid},10,${OWNER},${txid})`;
      await t`update public.transactions set amount=200 where id=${txid}`;
      const [afterEdit] = await t`select amount,deleted_at from public.goal_entries where id=${entryid}`;
      check(Number(afterEdit.amount) === 20 && afterEdit.deleted_at === null, "Reserve not recalculated to 20");
      await t`update public.transactions set deleted_at=now() where id=${txid}`;
      const [afterDelete] = await t`select deleted_at from public.goal_entries where id=${entryid}`;
      check(afterDelete.deleted_at !== null, "Reserve not cancelled on income deletion");
      checked = true;
      throw new ExpectedRollback("Fixture transaction intentionally rolled back");
    });
  } catch (e) {
    if (!(e instanceof ExpectedRollback)) throw e;
  }
  check(checked, "Reserve check not completed");
  console.log("PASS: reserve adjusts and cancels; synthetic reserve data rolled back");
}
try {
  await execute();
  console.log("PASS: staging financial integration checks");
} finally {
  // Restore only our known synthetic fixture. Never target user accounts.
  try {
    const [r] = await sql`select initial_balance from public.accounts where id=${A} and workspace_id=${WS}`;
    if (r && [120,123,124].includes(Number(r.initial_balance))) {
      await sql`update public.accounts set initial_balance=120 where id=${A} and workspace_id=${WS}`;
    }
  } finally {
    await sql.end();
  }
}
