
/**
 * Ultimate Inventory Valuation Logic
 * Supports FIFO (First-In First-Out), LIFO (Last-In First-Out), and Weighted Average
 */

export const calculateInventoryValue = (product) => {
    if (!product) return 0;
    if (product.valuationMethod === 'Weighted Average') {
        return (product.quantityOnHand || 0) * (product.costPrice || 0);
    }
    // For FIFO/LIFO, sum up remaining quantities in batches
    return (product.batches || []).reduce((total, batch) => {
        return total + ((batch.remainingQuantity || 0) * (batch.unitCost || 0));
    }, 0);
};

export const addStock = (product, quantity, unitCost, date = new Date()) => {
    const newBatch = {
        batchId: `BATCH-${Date.now()}`,
        date: date,
        quantity: quantity,
        unitCost: unitCost,
        remainingQuantity: quantity
    };

    let updatedProduct = { ...product };
    
    // Update Quantity on Hand
    updatedProduct.quantityOnHand = (updatedProduct.quantityOnHand || 0) + quantity;

    // Handle Weighted Average
    if (product.valuationMethod === 'Weighted Average') {
        const currentTotalValue = (product.quantityOnHand || 0) * (product.costPrice || 0);
        const newStockValue = quantity * unitCost;
        const totalQty = updatedProduct.quantityOnHand;
        
        // Calculate new weighted average cost
        updatedProduct.costPrice = (currentTotalValue + newStockValue) / totalQty;
    } 
    
    // Add Batch (Always track batches for history, even if Weighted Average)
    updatedProduct.batches = [...(product.batches || []), newBatch];

    return updatedProduct;
};

export const removeStock = (product, quantitySell) => {
    let updatedProduct = { ...product };
    let quantityRemainingToSell = quantitySell;
    let costOfGoodsSold = 0;
    let soldBatchesDetails = [];

    if (updatedProduct.quantityOnHand < quantitySell) {
        throw new Error(`Insufficient stock! Available: ${updatedProduct.quantityOnHand}, Requested: ${quantitySell}`);
    }

    updatedProduct.quantityOnHand -= quantitySell;

    // Weighted Average Logic
    if (updatedProduct.valuationMethod === 'Weighted Average') {
        costOfGoodsSold = quantitySell * updatedProduct.costPrice;
        return { updatedProduct, costOfGoodsSold, details: [`Sold ${quantitySell} at avg cost $${updatedProduct.costPrice.toFixed(2)}`] };
    }

    // Sort Batches based on Method
    // FIFO: Oldest First (Date Ascending)
    // LIFO: Newest First (Date Descending)
    let sortedBatches = [...(updatedProduct.batches || [])].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return updatedProduct.valuationMethod === 'FIFO' ? dateA - dateB : dateB - dateA;
    });

    // Process Batches
    const processedBatches = sortedBatches.map(batch => {
        if (quantityRemainingToSell <= 0 || batch.remainingQuantity <= 0) return batch;

        let takeQty = Math.min(quantityRemainingToSell, batch.remainingQuantity);
        
        costOfGoodsSold += takeQty * batch.unitCost;
        quantityRemainingToSell -= takeQty;
        
        soldBatchesDetails.push({
            batchId: batch.batchId,
            qtyTaken: takeQty,
            unitCost: batch.unitCost,
            totalCost: takeQty * batch.unitCost
        });

        return {
            ...batch,
            remainingQuantity: batch.remainingQuantity - takeQty
        };
    });

    // Re-assemble batches (we need to put them back in original order if we want, or just keep them sorted)
    // Ideally, keep original order but update values. 
    // For simplicity, we'll replace the batches list with the processed ones.
    updatedProduct.batches = processedBatches.filter(b => b.remainingQuantity >= 0); // Keep empty batches for history? or remove? usually keep 0 qty batches for audit or hide them. Let's keep them but UI can hide.

    return { updatedProduct, costOfGoodsSold, details: soldBatchesDetails };
};
