import "./App.css";
import { Cart } from "./components/Cart";
import { ItemTable } from "./components/ItemTable";
import { useCart } from "./hooks/useCart";
import { useItems } from "./hooks/useItems";

function App() {
  const { items, loading } = useItems();
  const {
    entries,
    totalPrice,
    totalItems,
    addItem,
    removeItem,
    setQuantity,
    clearCart,
  } = useCart();

  if (loading) {
    return (
      <div className="loading">
        <p>Loading item data...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pathshopper</h1>
        <p className="app-subtitle">
          Plan your equipment purchases for any budget
        </p>
      </header>

      <div className="app-body">
        <main className="app-main">
          <ItemTable items={items} onAddItem={addItem} />
        </main>
        <aside className="app-sidebar">
          <Cart
            entries={entries}
            totalPrice={totalPrice}
            totalItems={totalItems}
            onSetQuantity={setQuantity}
            onRemoveItem={removeItem}
            onClear={clearCart}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
