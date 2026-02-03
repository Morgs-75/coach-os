"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  cost_cents: number | null;
  stock_quantity: number | null;
  sku: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

const categories = [
  { value: "supplement", label: "Supplements" },
  { value: "merchandise", label: "Merchandise" },
  { value: "equipment", label: "Equipment" },
  { value: "digital", label: "Digital Products" },
  { value: "other", label: "Other" },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "supplement",
    price: "",
    cost: "",
    stock_quantity: "",
    sku: "",
    is_active: true,
  });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("name");

    if (error) {
      console.error("Error loading products:", error);
    }
    if (data) setProducts(data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      category: "supplement",
      price: "",
      cost: "",
      stock_quantity: "",
      sku: "",
      is_active: true,
    });
    setEditingProduct(null);
  }

  function editProduct(product: Product) {
    setFormData({
      name: product.name,
      description: product.description || "",
      category: product.category,
      price: (product.price_cents / 100).toString(),
      cost: product.cost_cents ? (product.cost_cents / 100).toString() : "",
      stock_quantity: product.stock_quantity?.toString() || "",
      sku: product.sku || "",
      is_active: product.is_active,
    });
    setEditingProduct(product);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      setSaving(false);
      return;
    }

    const productData = {
      org_id: membership.org_id,
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      price_cents: Math.round(parseFloat(formData.price) * 100),
      cost_cents: formData.cost ? Math.round(parseFloat(formData.cost) * 100) : null,
      stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null,
      sku: formData.sku || null,
      is_active: formData.is_active,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        alert("Error updating product: " + error.message);
      } else {
        setProducts(products.map((p) =>
          p.id === editingProduct.id ? { ...p, ...productData } : p
        ));
      }
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single();

      if (error) {
        alert("Error creating product: " + error.message);
      } else if (data) {
        setProducts([...products, data]);
      }
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
  }

  async function deleteProduct(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (!error) {
      setProducts(products.filter((p) => p.id !== product.id));
    }
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (!error) {
      setProducts(products.map((p) =>
        p.id === product.id ? { ...p, is_active: !p.is_active } : p
      ));
    }
  }

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);

  const filteredProducts = filterCategory === "all"
    ? products
    : products.filter((p) => p.category === filterCategory);

  const totalValue = products.reduce((sum, p) => {
    if (p.stock_quantity && p.cost_cents) {
      return sum + p.stock_quantity * p.cost_cents;
    }
    return sum;
  }, 0);

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">myProducts</h1>
          <p className="text-gray-500">Manage your inventory and products</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Add Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {products.filter((p) => p.is_active).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Low Stock (&lt;5)</p>
          <p className="text-2xl font-bold text-amber-600">
            {products.filter((p) => p.stock_quantity !== null && p.stock_quantity < 5).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Inventory Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(totalValue)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterCategory("all")}
          className={clsx(
            "px-3 py-1.5 rounded-lg text-sm font-medium",
            filterCategory === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium",
              filterCategory === cat.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Whey Protein 1kg"
                  required
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Product description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Sell Price (AUD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input"
                    placeholder="49.95"
                    required
                  />
                </div>
                <div>
                  <label className="label">Cost Price (AUD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="input"
                    placeholder="25.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="input"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="label">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="input"
                    placeholder="WP-001"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-brand-600"
                />
                <span className="text-sm text-gray-700">Active (available for sale)</span>
              </label>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products List */}
      {filteredProducts.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const margin = product.cost_cents
                  ? ((product.price_cents - product.cost_cents) / product.price_cents) * 100
                  : null;
                const lowStock = product.stock_quantity !== null && product.stock_quantity < 5;

                return (
                  <tr key={product.id} className={clsx(!product.is_active && "bg-gray-50 opacity-60")}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        {product.sku && <p className="text-xs text-gray-500">SKU: {product.sku}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {categories.find((c) => c.value === product.category)?.label || product.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatPrice(product.price_cents)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {product.cost_cents ? formatPrice(product.cost_cents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {margin !== null ? (
                        <span className={clsx(
                          "font-medium",
                          margin >= 30 ? "text-green-600" : margin >= 15 ? "text-amber-600" : "text-red-600"
                        )}>
                          {margin.toFixed(0)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {product.stock_quantity !== null ? (
                        <span className={clsx(
                          "font-medium",
                          lowStock ? "text-red-600" : "text-gray-900"
                        )}>
                          {product.stock_quantity}
                          {lowStock && " ⚠️"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(product)}
                        className={clsx(
                          "px-2 py-1 rounded text-xs font-medium",
                          product.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => editProduct(product)}
                        className="text-brand-600 hover:text-brand-700 text-sm font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProduct(product)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
          <p className="text-gray-500 mb-4">
            Add products to track inventory and sell to clients.
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn-primary"
          >
            Add Your First Product
          </button>
        </div>
      )}
    </div>
  );
}
